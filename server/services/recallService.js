// server/services/recallService.js
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_BASE_URL = 'https://us-west-2.recall.ai/api/v1';

const headers = {
  'Authorization': `Token ${RECALL_API_KEY}`,
  'Content-Type': 'application/json',
};

// ─── CREATE BOT (send to a meeting — no transcription, async later) ──────────

async function createBot(meetingUrl, botName = 'Planfor Assistant') {
  const response = await fetch(`${RECALL_BASE_URL}/bot`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
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
    recordingId: data.recording?.split('/').filter(Boolean).pop() || null,
  };
}

// ─── CREATE ASYNC TRANSCRIPT ─────────────────────────────────────────────────

async function createAsyncTranscript(recordingId) {
  const response = await fetch(`${RECALL_BASE_URL}/recording/${recordingId}/create_transcript/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: {
        recallai_async: {
          language_code: 'en',
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai create transcript failed: ${response.status} — ${error}`);
  }

  const data = await response.json();
  console.log('📝 Recall.ai transcript job created for recording:', recordingId);
  return data;
}

// ─── FETCH TRANSCRIPT ────────────────────────────────────────────────────────

async function fetchTranscript(transcriptId) {
  const response = await fetch(`${RECALL_BASE_URL}/transcript/${transcriptId}/`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai fetch transcript failed: ${response.status} — ${error}`);
  }

  const data = await response.json();

  // Download the actual transcript from the pre-signed URL
  if (data.data?.download_url) {
    const transcriptResponse = await fetch(data.data.download_url);
    const transcriptData = await transcriptResponse.json();

    // Parse transcript segments with speaker labels
    const segments = (transcriptData || []).map(segment => ({
      speaker: segment.speaker || 'Unknown',
      text: (segment.words || []).map(w => w.text).join(' '),
      startTime: segment.words?.[0]?.start_time || segment.start_time || 0,
      endTime: segment.words?.[segment.words.length - 1]?.end_time || segment.end_time || 0,
    }));

    const fullText = segments.map(s => `${s.speaker}: ${s.text}`).join('\n\n');

    return { fullText, segments };
  }

  throw new Error('No transcript download URL available');
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
  createAsyncTranscript,
  fetchTranscript,
  mapRecallStatus,
};