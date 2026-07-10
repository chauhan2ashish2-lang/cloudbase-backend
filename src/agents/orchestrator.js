import { callAgent } from './llmClient.js';
import { generateContentBatch } from './contentAgent.js';
// import { generateAdCampaign } from './adsAgent.js';
// import { generateDesignBriefs } from './designAgent.js';
// import { analyzeCompetitors } from './competitorResearchAgent.js';
// import { fetchTrends } from './trendResearchAgent.js';
// import { summarizeAnalytics } from './analyticsAgent.js';

const ROUTER_SYSTEM_PROMPT = `You are the Orchestrator for a team of marketing AI agents:
content, design, ads, seo, analytics, competitor_research, trend_research.
Given a user's natural-language request, decide which single agent should handle it and
extract the parameters that agent needs. Respond with ONLY JSON:
{ "agent": "content" | "design" | "ads" | "seo" | "analytics" | "competitor_research" | "trend_research",
  "params": { ... } }`;

/**
 * Entry point for the AI Chat Console. Classifies the user's message to the
 * right specialized agent, then executes it.
 */
export async function handleChatMessage({ business, strategy, message }) {
  const { json: routing } = await callAgent({
    provider: 'claude',
    system: ROUTER_SYSTEM_PROMPT,
    prompt: `User request: "${message}"`,
    agentType: 'orchestrator',
    agencyId: business.agency_id,
    businessId: business.id,
  });

  switch (routing?.agent) {
    case 'content':
      return {
        agent: 'content',
        result: await generateContentBatch({
          business,
          strategy,
          count: routing.params?.count || 5,
          categories: routing.params?.categories,
        }),
      };
    // case 'ads': return { agent: 'ads', result: await generateAdCampaign({ business, ...routing.params }) };
    // case 'design': return { agent: 'design', result: await generateDesignBriefs({ business, ...routing.params }) };
    // case 'competitor_research': return { agent: 'competitor_research', result: await analyzeCompetitors({ business }) };
    // case 'trend_research': return { agent: 'trend_research', result: await fetchTrends({ business }) };
    // case 'analytics': return { agent: 'analytics', result: await summarizeAnalytics({ business }) };
    default:
      return {
        agent: routing?.agent || 'unknown',
        result: null,
        note: 'Agent not yet implemented in this scaffold — see docs/IMPLEMENTATION_PLAN.md',
      };
  }
}
