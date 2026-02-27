// ═══════════════════════════════════════════════════════════════
// Stockclaw — Embedding Service (server-side only)
// LLM text-embedding for RAG match memory.
// Gemini text-embedding-004 (256d) → Groq fallback (mock).
// ═══════════════════════════════════════════════════════════════

import { GEMINI_API_KEY, GEMINI_ENDPOINT, isGeminiAvailable } from './llmConfig';
import { RAG_EMBEDDING_DIM } from '$lib/engine/constants';

// ── Types ──────────────────────────────────────────────────

export interface EmbeddingResult {
  embedding: number[];
  provider: 'gemini' | 'hash';
  model: string;
  dimensions: number;
}

// ── Gemini Text Embedding ──────────────────────────────────

const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';

async function callGeminiEmbedding(text: string, timeoutMs = 10_000): Promise<EmbeddingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${GEMINI_ENDPOINT}/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: RAG_EMBEDDING_DIM,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini embedding ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const values: number[] = data?.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Gemini embedding: no values in response');
    }

    return {
      embedding: values.slice(0, RAG_EMBEDDING_DIM),
      provider: 'gemini',
      model: GEMINI_EMBEDDING_MODEL,
      dimensions: RAG_EMBEDDING_DIM,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Deterministic Hash Fallback ────────────────────────────
// When no embedding API is available, generate a deterministic
// pseudo-embedding from text hash. Not semantically meaningful
// but ensures data flow continuity and consistent deduplication.

function hashEmbedding(text: string): EmbeddingResult {
  const vec = new Float32Array(RAG_EMBEDDING_DIM);
  let h = 0x811c9dc5; // FNV-1a offset basis

  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  for (let i = 0; i < RAG_EMBEDDING_DIM; i++) {
    h ^= (i * 0x9e3779b9);
    h = Math.imul(h, 0x01000193);
    vec[i] = ((h >>> 0) / 0xffffffff) * 2 - 1; // normalize to [-1, 1]
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }

  return {
    embedding: Array.from(vec),
    provider: 'hash',
    model: 'fnv1a-256d',
    dimensions: RAG_EMBEDDING_DIM,
  };
}

// ── Public API ─────────────────────────────────────────────

/**
 * Generate embedding for a memory text.
 * Uses Gemini text-embedding-004 if available, else deterministic hash.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text.trim()) return hashEmbedding('');

  if (isGeminiAvailable()) {
    try {
      return await callGeminiEmbedding(text);
    } catch (err) {
      console.warn('[embedding] Gemini embedding failed, using hash fallback:', err);
    }
  }

  return hashEmbedding(text);
}

/**
 * Build a memory text string from match data for embedding.
 * Combines direction, agent analysis, thesis, and outcome.
 */
export function buildMemoryText(params: {
  pair: string;
  direction: string;
  confidence: number;
  thesis: string;
  agentId: string;
  marketRegime?: string | null;
  outcome: boolean;
  lesson?: string;
}): string {
  const parts = [
    `${params.pair} ${params.direction}`,
    `confidence:${params.confidence}`,
    `agent:${params.agentId}`,
  ];
  if (params.marketRegime) parts.push(`regime:${params.marketRegime}`);
  if (params.thesis) parts.push(params.thesis.slice(0, 200));
  parts.push(params.outcome ? 'WIN' : 'LOSS');
  if (params.lesson) parts.push(params.lesson.slice(0, 200));
  return parts.join(' | ');
}

/**
 * Format a 256d embedding as PostgreSQL vector literal.
 * e.g., "[0.1,0.2,...]"
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
