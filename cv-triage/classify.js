'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const VALID_CATEGORIES = [
  'CV/Project Manager - Civil',
  'CV/Project Manager - Mechanical',
  'CV/Project Manager - Electrical',
  'CV/Planning Lead',
  'CV/Site Engineer',
  'CV/Project Manager - General',
  'CV/Other',
];

const SYSTEM_PROMPT = `You are a senior technical recruiter. Classify the CV into exactly one role category from this list:
${VALID_CATEGORIES.map((c) => `- ${c}`).join('\n')}

Return JSON only, no markdown fences, no extra text:
{ "category": "<label name>", "candidate_name": "<name>", "confidence": "high|medium|low", "rationale": "<one sentence>" }`;

let client;

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

async function classifyCV(text) {
  const truncated = text.slice(0, 12000); // keep within token budget

  const attempt = async () => {
    const message = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: truncated }],
    });

    const raw = message.content[0].text.trim();
    const parsed = JSON.parse(raw);

    if (!VALID_CATEGORIES.includes(parsed.category)) {
      parsed.category = 'CV/Other';
    }

    return parsed;
  };

  try {
    return await attempt();
  } catch (firstErr) {
    // retry once
    try {
      await sleep(2000);
      return await attempt();
    } catch (secondErr) {
      console.error(`  Claude API error after retry: ${secondErr.message}`);
      return null;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { classifyCV, VALID_CATEGORIES };
