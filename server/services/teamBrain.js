// server/services/teamBrain.js
const supabase = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateTeamInsight() {
  try {
    // Fetch thoughts from last 7 days — all users, no attribution
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: thoughts, error } = await supabase
      .from('crm_thoughts')
      .select('content, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!thoughts || thoughts.length === 0) {
      console.log('🧠 Team Superbrain — no thoughts in last 7 days, skipping');
      return null;
    }

    // Count unique users separately
    const { data: userCount } = await supabase
      .from('crm_thoughts')
      .select('user_id')
      .gte('created_at', since);

    const uniqueUsers = new Set((userCount || []).map(t => t.user_id)).size;

    // Build anonymous thought list
    const thoughtList = thoughts
      .map((t, i) => `- ${t.content.trim()}`)
      .join('\n');

    const prompt = `You are analyzing private thoughts from a CRM sales and marketing team. These thoughts were written independently by different team members over the past 7 days.

Your job: identify patterns, recurring themes, tensions, and actionable insights for the team — WITHOUT revealing who wrote what or referencing individual people.

Thoughts:
${thoughtList}

Write a concise team insight (3-5 sentences max). Focus on:
- Patterns that appear across multiple thoughts
- Opportunities or risks the team seems to be collectively sensing
- One concrete suggestion the team could act on

Be direct and specific. Do not be generic. Do not say "team members think" — speak as if surfacing collective intelligence.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const insight = response.content[0]?.text?.trim();
    if (!insight) return null;

    // Save to DB
    const { data: saved, error: saveError } = await supabase
      .from('crm_team_insights')
      .insert([{
        insight,
        thought_count: thoughts.length,
        user_count: uniqueUsers,
        generated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (saveError) throw new Error(saveError.message);

    console.log(`🧠 Team Superbrain — insight generated from ${thoughts.length} thoughts across ${uniqueUsers} users`);
    return saved;

  } catch (err) {
    console.error('🧠 Team Superbrain error:', err.message);
    return null;
  }
}

async function getLatestInsight() {
  const { data, error } = await supabase
    .from('crm_team_insights')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

module.exports = { generateTeamInsight, getLatestInsight };