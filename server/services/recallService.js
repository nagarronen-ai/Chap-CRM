// server/services/recallService.js
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_BASE_URL = 'https://us-west-2.recall.ai/api/v1';

const headers = {
  'Authorization': `Token ${RECALL_API_KEY}`,
  'Content-Type': 'application/json',
};

// ─── CREATE BOT (send to a meeting) ──────────────────────────────────────────

async function createBot(meetingUrl, botName = 'Planfor Assistant') {
  const response = await fetch(`${RECALL_BASE_URL}/bot`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      transcription_options: {
        provider: 'default',
      },
      real_time_transcription: {
        partial_results: false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai create bot failed: ${response.status} — ${error}`);
  }

  const data = await response.json();
  console.log('🤖 Recall.ai bot created:', data.id, '| Meeting:', meetingUrl);
  return {
    botId: data.id,
    status: data.status_changes?.[data.status_changes.length - 1]?.code || 'ready',
  };
}

// ─── GET BOT STATUS ──────────────────────────────────────────────────────────

async function getBotStatus(botId) {
  const response = await fetch(`${RECALL_BASE_URL}/bot/${botId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai get bot failed: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const latestStatus = data.status_changes?.[data.status_changes.length - 1]?.code || 'unknown';

  return {
    botId: data.id,
    status: latestStatus,
    meetingUrl: data.meeting_url,
    videoUrl: data.video_url || null,
    recordingUrl: data.recording || null,
  };
}

// ─── GET TRANSCRIPT ──────────────────────────────────────────────────────────

async function getTranscript(botId) {
  const response = await fetch(`${RECALL_BASE_URL}/bot/${botId}/transcript`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai get transcript failed: ${response.status} — ${error}`);
  }

  const data = await response.json();

  // data is an array of segments: [{ speaker, words: [{ text, start_time, end_time }] }]
  // Build full transcript text and structured segments
  const segments = (data || []).map(segment => ({
    speaker: segment.speaker || 'Unknown',
    text: (segment.words || []).map(w => w.text).join(' '),
    startTime: segment.words?.[0]?.start_time || 0,
    endTime: segment.words?.[segment.words.length - 1]?.end_time || 0,
  }));

  const fullText = segments.map(s => `${s.speaker}: ${s.text}`).join('\n\n');

  return {
    fullText,
    segments,
  };
}

// ─── MAP RECALL STATUS TO CRM STATUS ─────────────────────────────────────────

function mapRecallStatus(recallStatus) {
  const statusMap = {
    'ready': 'sending_bot',
    'joining_call': 'sending_bot',
    'in_waiting_room': 'sending_bot',
    'in_call_not_recording': 'sending_bot',
    'in_call_recording': 'recording',
    'call_ended': 'processing',
    'done': 'processing',
    'media_expired': 'completed',
    'analysis_done': 'completed',
    'fatal': 'failed',
  };
  return statusMap[recallStatus] || 'sending_bot';
}

module.exports = {
  createBot,
  getBotStatus,
  getTranscript,
  mapRecallStatus,
};