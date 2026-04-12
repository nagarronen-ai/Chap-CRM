// server/services/aiSummary.js
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── GENERATE MEETING SUMMARY ────────────────────────────────────────────────

async function generateMeetingSummary(transcript, meetingContext = {}) {
  const { title, companyName, contactName, meetingType } = meetingContext;

  const contextParts = [];
  if (title) contextParts.push(`Meeting title: ${title}`);
  if (companyName) contextParts.push(`Company: ${companyName}`);
  if (contactName) contextParts.push(`Contact: ${contactName}`);
  if (meetingType) contextParts.push(`Type: ${meetingType === 'google_meet' ? 'Video Call (Google Meet)' : 'Phone Call'}`);

  const contextStr = contextParts.length > 0 ? `\n\nMeeting context:\n${contextParts.join('\n')}` : '';

  const prompt = `You are a sales meeting analyst for a company. 
Your job is to analyze meeting transcripts and provide actionable insights.${contextStr}

Analyze the following meeting transcript and respond with ONLY valid JSON (no markdown, no backticks, no preamble) in this exact format:
{
  "summary": "A concise 3-5 sentence summary of the meeting. Focus on what was discussed, any decisions made, and the overall tone.",
  "key_takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "action_items": [
    {"task": "description of action item", "owner": "person responsible or 'TBD'", "priority": "high/medium/low"},
    {"task": "another action item", "owner": "person or TBD", "priority": "high/medium/low"}
  ],
  "sentiment": "positive/neutral/negative/mixed",
  "next_steps": "Brief description of what should happen next based on this meeting"
}

Important rules:
- Keep the summary concise and focused on business outcomes
- Action items should be specific and actionable
- If you can identify who should own an action item from the transcript, include their name
- Sentiment should reflect the overall tone of the meeting (are they interested, hesitant, excited, etc.)
- If the transcript is too short or unclear, do your best with what's available

Transcript:
${transcript}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Clean and parse the response
    const cleaned = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary || 'No summary available.',
      keyTakeaways: parsed.key_takeaways || [],
      actionItems: parsed.action_items || [],
      sentiment: parsed.sentiment || 'neutral',
      nextSteps: parsed.next_steps || '',
    };
  } catch (err) {
    console.error('OpenAI summary error:', err.message);
    
    // If JSON parsing fails, try to extract what we can
    if (err instanceof SyntaxError) {
      return {
        summary: 'AI summary could not be parsed. Please check the transcript manually.',
        keyTakeaways: [],
        actionItems: [],
        sentiment: 'neutral',
        nextSteps: '',
      };
    }
    
    throw err;
  }
}

module.exports = {
  generateMeetingSummary,
};