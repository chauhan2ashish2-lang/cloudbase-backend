import { callAgent } from './llmClient.js';
import { query } from '../config/db.js';

const SYSTEM_PROMPT = `You are the Content Agent inside an AI marketing platform. You write
Facebook and Instagram content for small-to-medium businesses. You always respond with
ONLY valid JSON (no markdown fences, no preamble) matching the requested schema. Captions
should sound native to the platform, match the given brand voice, and avoid generic filler.
Hashtags should be a realistic mix of broad + niche + branded tags. Never invent statistics
or claims not supported by the business context provided.`;

/**
 * Generates a batch of content post drafts for a business based on its active
 * marketing strategy, and persists them as `draft` rows in content_posts.
 */
export async function generateContentBatch({ business, strategy, count = 5, categories }) {
  const prompt = `
Business context:
- Name: ${business.name}
- Industry: ${business.industry}
- Products/services: ${business.products_services}
- Target audience: ${business.target_audience}
- Brand voice: ${business.brand_voice || 'friendly, professional'}
- Country/Language: ${business.country} / ${business.language}

Strategy content pillars: ${JSON.stringify(strategy?.content_pillars || [])}

Generate ${count} social media posts across these categories: ${JSON.stringify(
    categories || ['promotional', 'educational', 'engagement']
  )}.

Respond with ONLY this JSON shape:
{
  "posts": [
    {
      "platform": "facebook" | "instagram",
      "post_type": "single_image" | "carousel" | "reel" | "text",
      "category": "promotional" | "educational" | "lead_gen" | "product_launch" | "engagement" | "festival" | "other",
      "caption": "string",
      "hashtags": ["string", ...],
      "cta": "string",
      "reel_script": "string or null (only for post_type=reel)",
      "image_brief": "1-2 sentence description for the Design Agent to generate a matching creative"
    }
  ]
}`;

  const { json, text } = await callAgent({
    provider: 'claude',
    system: SYSTEM_PROMPT,
    prompt,
    agentType: 'content',
    agencyId: business.agency_id,
    businessId: business.id,
  });

  const posts = json?.posts || [];
  const inserted = [];
  for (const post of posts) {
    const result = await query(
      `INSERT INTO content_posts
        (business_id, platform, post_type, category, caption, hashtags, cta, reel_script, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft','ai')
       RETURNING id, platform, post_type, category, caption, hashtags, cta`,
      [
        business.id,
        post.platform,
        post.post_type,
        post.category,
        post.caption,
        post.hashtags || [],
        post.cta,
        post.reel_script || null,
      ]
    );
    inserted.push({ ...result.rows[0], image_brief: post.image_brief });
  }

  if (!posts.length) {
    // Surface the raw model output for debugging if JSON parsing failed.
    console.warn('[contentAgent] No structured posts parsed. Raw output:', text?.slice(0, 300));
  }

  return inserted;
}
