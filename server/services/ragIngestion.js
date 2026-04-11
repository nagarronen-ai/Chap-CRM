// server/services/ragIngestion.js
const supabase = require('../db');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── EMBED A SINGLE TEXT CHUNK ────────────────────────────────────────────────

async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // token safety cap
  });
  return response.data[0].embedding;
}

// ─── UPSERT EMBEDDING ─────────────────────────────────────────────────────────

async function upsertEmbedding(sourceTable, sourceId, chunkText, metadata = {}) {
  if (!chunkText || chunkText.trim().length < 20) return;

  const embedding = await embedText(chunkText);

  const { error } = await supabase
    .from('crm_embeddings')
    .upsert({
      source_table: sourceTable,
      source_id: sourceId,
      chunk_text: chunkText.trim(),
      embedding: JSON.stringify(embedding),
      metadata,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'source_table,source_id',
    });

  if (error) console.error(`RAG upsert error [${sourceTable}:${sourceId}]:`, error.message);
}

// ─── INGEST SOURCES ───────────────────────────────────────────────────────────

async function ingestEmails() {
    const { data, error } = await supabase
      .from('crm_synced_emails')
      .select('id, subject, body_html, from_email, email_date, company_id')
    .order('email_date', { ascending: false })
    .limit(500);

  if (error) return console.error('RAG ingest emails error:', error.message);

  for (const row of data || []) {
    const text = [
        row.subject ? `Subject: ${row.subject}` : '',
        row.from_email ? `From: ${row.from_email}` : '',
        row.body_html ? row.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '',
      ].filter(Boolean).join('\n');

      await upsertEmbedding('crm_synced_emails', row.id, text, {
        subject: row.subject,
        from_email: row.from_email,
        company_id: row.company_id,
        date: row.email_date,
      });
  }
  console.log(`✅ RAG: ingested ${data?.length || 0} emails`);
}

async function ingestNotes() {
    const { data, error } = await supabase
      .from('crm_activity_log')
      .select('id, details, created_at, company_id')
      .eq('action', 'Note Added')
      .not('details', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);
  
    if (error) return console.error('RAG ingest notes error:', error.message);
  
    for (const row of data || []) {
        if (!row.details) continue;
        await upsertEmbedding('crm_activity_log', row.id, `Note: ${row.details}`, {
        company_id: row.company_id,
        date: row.created_at,
      });
    }
    console.log(`✅ RAG: ingested ${data?.length || 0} notes`);
  }

async function ingestThoughts() {
  const { data, error } = await supabase
    .from('crm_thoughts')
    .select('id, content, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return console.error('RAG ingest thoughts error:', error.message);

  for (const row of data || []) {
    if (!row.content) continue;
    await upsertEmbedding('crm_thoughts', row.id, `Thought: ${row.content}`, {
      user_id: row.user_id,
      date: row.created_at,
    });
  }
  console.log(`✅ RAG: ingested ${data?.length || 0} thoughts`);
}

async function ingestSentEmails() {
  const { data, error } = await supabase
    .from('crm_emails_sent')
    .select('id, subject, body_html, status, company_id, created_at')
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return console.error('RAG ingest sent emails error:', error.message);

  for (const row of data || []) {
    const text = [
      row.subject ? `Subject: ${row.subject}` : '',
      row.body_html ? row.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '',
    ].filter(Boolean).join('\n');

    await upsertEmbedding('crm_emails_sent', row.id, text, {
      subject: row.subject,
      company_id: row.company_id,
      date: row.created_at,
    });
  }
  console.log(`✅ RAG: ingested ${data?.length || 0} sent emails`);
}

async function ingestMeetings() {
    const { data, error } = await supabase
      .from('crm_meetings')
      .select('id, title, ai_summary, notes, company_id, start_time')
      .not('ai_summary', 'is', null)
    .order('start_time', { ascending: false })
    .limit(200);

  if (error) return console.error('RAG ingest meetings error:', error.message);

  for (const row of data || []) {
    const text = [
        row.title ? `Meeting: ${row.title}` : '',
        row.ai_summary ? `Summary: ${row.ai_summary}` : '',
        row.notes ? `Notes: ${row.notes}` : '',
      ].filter(Boolean).join('\n');

    await upsertEmbedding('crm_meetings', row.id, text, {
      company_id: row.company_id,
      date: row.start_time,
    });
  }
  console.log(`✅ RAG: ingested ${data?.length || 0} meetings`);
}

// ─── FULL INGEST RUN ──────────────────────────────────────────────────────────

async function runFullIngestion() {
  console.log('🧠 RAG: starting full ingestion...');
  try {
    await ingestEmails();
    await ingestNotes();
    await ingestThoughts();
    await ingestSentEmails();
    await ingestMeetings();
    console.log('🧠 RAG: ingestion complete');
  } catch (err) {
    console.error('🧠 RAG ingestion error:', err.message);
  }
}

module.exports = { runFullIngestion, upsertEmbedding };