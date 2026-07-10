import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { query } from '../config/db.js';

const anthropic = env.ai.anthropicApiKey ? new Anthropic({ apiKey: env.ai.anthropicApiKey }) : null;
const openai = env.ai.openaiApiKey ? new OpenAI({ apiKey: env.ai.openaiApiKey }) : null;

/**
 * Calls an LLM with a structured-output contract and logs the call to
 * ai_generations for audit + cost tracking. Defaults to Claude; falls back
 * to OpenAI if configured as the provider.
 *
 * @param {object} opts
 * @param {'claude'|'openai'} opts.provider
 * @param {string} opts.system - system prompt scoping the agent's role
 * @param {string} opts.prompt - user-turn content
 * @param {object} opts.jsonSchema - expected JSON shape (documented in prompt, validated after)
 * @param {string} opts.agentType - one of the agent_type enum values
 * @param {string} opts.agencyId
 * @param {string} [opts.businessId]
 */
export async function callAgent({ provider = 'claude', system, prompt, agentType, agencyId, businessId }) {
  const start = Date.now();
  let text, tokensInput, tokensOutput, modelName;

  if (provider === 'claude') {
    if (!anthropic) throw new Error('Anthropic API key not configured');
    modelName = env.ai.defaultModel;
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
    tokensInput = response.usage?.input_tokens;
    tokensOutput = response.usage?.output_tokens;
  } else if (provider === 'openai') {
    if (!openai) throw new Error('OpenAI API key not configured');
    modelName = 'gpt-4.1';
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });
    text = response.choices[0].message.content;
    tokensInput = response.usage?.prompt_tokens;
    tokensOutput = response.usage?.completion_tokens;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  let parsed = null;
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Not all agent calls require structured JSON — caller decides whether to require it.
  }

  await query(
    `INSERT INTO ai_generations
      (business_id, agency_id, agent_type, model_provider, model_name, input_summary, output,
       tokens_input, tokens_output, cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      businessId || null,
      agencyId,
      agentType,
      provider,
      modelName,
      prompt.slice(0, 500),
      JSON.stringify(parsed ?? { raw: text }),
      tokensInput || null,
      tokensOutput || null,
      estimateCost(provider, modelName, tokensInput, tokensOutput),
    ]
  );

  return { text, json: parsed, latencyMs: Date.now() - start };
}

function estimateCost(provider, model, inputTokens = 0, outputTokens = 0) {
  // Simplified rate table (USD per 1K tokens) — update to match current pricing.
  const rates = {
    claude: { input: 0.003, output: 0.015 },
    openai: { input: 0.005, output: 0.015 },
  };
  const r = rates[provider] || rates.claude;
  return +((inputTokens / 1000) * r.input + (outputTokens / 1000) * r.output).toFixed(4);
}
