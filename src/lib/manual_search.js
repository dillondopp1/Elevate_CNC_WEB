/**
 * Lexical (BM25) search over the CNC12 manual chunks.
 * No embeddings / vector DB — just term-frequency scoring, computed once at
 * module load. Cheap, dependency-free, good enough for ~170 chunks.
 */
import manualData from './cnc12_manual.json' assert { type: 'json' };

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are',
  'be', 'this', 'that', 'with', 'as', 'by', 'at', 'from', 'it', 'your', 'you',
  'can', 'will', 'if', 'not', 'all', 'must', 'which', 'has', 'have', 'into',
  'their', 'these', 'those', 'when', 'may', 'should', 'was', 'were', 'been',
  'than', 'then', 'also', 'any', 'but', 'do', 'does', 'how', 'what',
]);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || [])
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

const chunks = manualData.chunks;
const chunkTokens = chunks.map(c => tokenize(c.text));
const N = chunks.length;
const avgLen = chunkTokens.reduce((sum, t) => sum + t.length, 0) / N;

const df = new Map();
chunkTokens.forEach(tokens => {
  new Set(tokens).forEach(t => df.set(t, (df.get(t) || 0) + 1));
});

function idf(term) {
  const n = df.get(term) || 0;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

const K1 = 1.5;
const B = 0.75;

function scoreChunk(queryTokens, tokens) {
  const len = tokens.length;
  const tf = new Map();
  tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
  let score = 0;
  for (const term of queryTokens) {
    const f = tf.get(term) || 0;
    if (!f) continue;
    score += idf(term) * (f * (K1 + 1)) / (f + K1 * (1 - B + (B * len) / avgLen));
  }
  return score;
}

/** Returns the topK most relevant manual chunks for a query. */
export function searchManual(query, topK = 5) {
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length) return [];
  const scored = chunks.map((c, i) => ({ chunk: c, score: scoreChunk(queryTokens, chunkTokens[i]) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0).slice(0, topK).map(s => s.chunk);
}
