import Anthropic from '@anthropic-ai/sdk';
import { searchManual } from '../../src/lib/manual_search.js';
import { verifyToken } from '../../src/lib/support_token.js';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT_BASE = `You are the Elevate CNC support assistant. You help customers troubleshoot their CNC12-controlled router (Acorn, AcornSix, or Hickory control) using ONLY the manual excerpts provided below each user message.

## Rules
- Answer ONLY from the provided manual excerpts. Do not use outside knowledge about CNC machines, electronics, or software — even if you think you know the answer.
- If the excerpts don't contain a real answer, say so plainly and tell the customer to contact Elevate CNC directly at (208) 557-1587 or info@elevatecnc.com. Do NOT guess or improvise troubleshooting steps.
- This is physical machinery — a wrong guess can damage a machine or hurt someone. When in doubt, escalate to a human instead of answering.
- Cite the manual page number(s) you're pulling from when you give an answer (e.g. "See page 197").
- Keep answers short and concrete — numbered steps when the manual gives steps.
- Never give electrical, wiring, or safety-override instructions beyond exactly what the manual excerpt says.`;

function buildContext(chunks) {
  if (!chunks.length) {
    return 'No relevant manual sections were found for this question.';
  }
  return chunks
    .map(c => `--- Manual page ${c.pageStart}${c.pageEnd !== c.pageStart ? `-${c.pageEnd}` : ''} ---\n${c.text}`)
    .join('\n\n');
}

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { messages, token } = JSON.parse(event.body || '{}');

    if (!verifyToken(token, process.env.SUPPORT_TOKEN_SECRET)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authorized' }) };
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages array required' }) };
    }

    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const query = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : (lastUserMessage?.content || []).map(b => b.text || '').join(' ');

    const relevantChunks = searchManual(query, 5);
    const system = `${SYSTEM_PROMPT_BASE}\n\n## Manual excerpts for this question\n\n${buildContext(relevantChunks)}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages,
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return { statusCode: 200, headers, body: JSON.stringify({ response: text }) };
  } catch (err) {
    console.error('Support chat function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
