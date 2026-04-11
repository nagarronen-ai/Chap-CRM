// server/services/ragSearch.js
const supabase = require('../db');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function searchMemory(query, options = {}) {
  const {
    matchThreshold = 0.5,
    matchCount = 8,
    sourceTable = null,
  } = options;

  // Embed the query
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query.slice(0, 8000),
  });
  const queryEmbedding = response.data[0].embedding;

  // Run vector similarity search
  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error('RAG search error:', error.message);
    return [];
  }

  // Optional filter by source table
  const results = sourceTable
    ? (data || []).filter(r => r.source_table === sourceTable)
    : (data || []);

  return results.map(r => ({
    source: r.source_table,
    sourceId: r.source_id,
    text: r.chunk_text,
    metadata: r.metadata,
    similarity: Math.round(r.similarity * 100) / 100,
  }));
}

module.exports = { searchMemory };