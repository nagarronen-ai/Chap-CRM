// server/services/slackBot.js
const { App } = require('@slack/bolt');
const supabase = require('../db');
const { chat } = require('./aiBrain');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// ─── HELPER: GET OR CREATE CONVERSATION FOR SLACK USER ───────────────────────

async function getSlackUser(slackUserId) {
  // Look up CRM user by slack_user_id
  const { data: user } = await supabase
    .from('crm_users')
    .select('id, name, email')
    .eq('slack_user_id', slackUserId)
    .single();

  return user || null;
}

// ─── HELPER: SEND BLOCK KIT CONFIRMATION CARD ────────────────────────────────

async function sendConfirmationCard(channelId, message, pendingActions, conversationId) {
  const actionSummaries = pendingActions.map(a => {
    switch (a.tool) {
      case 'send_email':
        return `📧 Send email to ${a.args.recipient_name} (${a.args.recipient_email})\nSubject: "${a.args.subject}"`;
      case 'propose_meeting':
        return `📩 Propose meeting to ${a.args.recipient_name}\nSubject: "${a.args.subject}"\nProposed: ${a.args.proposed_date} at ${a.args.proposed_start_hour}:${String(a.args.proposed_start_min || 0).padStart(2, '0')}`;
      case 'book_meeting':
        return `📅 Book meeting: "${a.args.title}"\nDate: ${a.args.date} at ${a.args.start_hour}:${String(a.args.start_min || 0).padStart(2, '0')}`;
      case 'cancel_meeting':
        return `❌ Cancel meeting ID: ${a.args.meeting_id}`;
      case 'reschedule_meeting':
        return `📅 Reschedule meeting to ${a.args.date} at ${a.args.start_hour}:${String(a.args.start_min || 0).padStart(2, '0')}`;
      case 'send_bulk_email':
        return `📧 Bulk email to ${a.args.recipients?.length || 0} contacts\nSubject: "${a.args.subject}"`;
      default:
        return `⚡ ${a.tool}`;
    }
  });

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Confirm Action*\n${message}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: actionSummaries.map(s => `\`\`\`${s}\`\`\``).join('\n'),
      },
    },
    {
      type: 'actions',
      block_id: `confirm_${conversationId}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Confirm', emoji: true },
          style: 'primary',
          action_id: 'confirm_action',
          value: conversationId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '❌ Cancel', emoji: true },
          style: 'danger',
          action_id: 'cancel_action',
          value: conversationId,
        },
      ],
    },
  ];

  await app.client.chat.postMessage({
    channel: channelId,
    text: message,
    blocks,
  });
}

// ─── HANDLE INCOMING DM MESSAGES ─────────────────────────────────────────────

app.message(async ({ message, say }) => {
  // Only handle DMs (direct messages)
  if (message.channel_type !== 'im') return;
  if (message.bot_id) return; // ignore bot messages
  if (!message.text) return;

  const slackUserId = message.user;
  const channelId = message.channel;
  const userMessage = message.text.trim();

  // Look up CRM user
  const crmUser = await getSlackUser(slackUserId);
  if (!crmUser) {
    await say("I don't recognize your Slack account in the CRM. Ask your admin to link your Slack user ID in Settings.");
    return;
  }

  // Log thought if message starts with "thought:" or "idea:"
  const lowerMsg = userMessage.toLowerCase();
  if (lowerMsg.startsWith('thought:') || lowerMsg.startsWith('idea:')) {
    const content = userMessage.replace(/^(thought:|idea:)/i, '').trim();
    if (content) {
      await supabase.from('crm_thoughts').insert([{ user_id: crmUser.id, content }]);
      await say('💭 Got it — logged to My Thoughts ✓');
      return;
    }
  }

  // Show typing indicator
  await say({ text: '🧠 Thinking...' });

  try {
    const result = await chat(crmUser.id, userMessage, null, null);

    if (result.type === 'text') {
      await say(result.content);
    } else if (result.type === 'confirmation') {
      // Store pending actions in DB for retrieval when button is clicked
      await supabase
        .from('crm_slack_pending')
        .insert([{
          conversation_id: result.conversationId,
          slack_user_id: slackUserId,
          slack_channel_id: channelId,
          pending_actions: result.pending_actions,
          created_at: new Date().toISOString(),
        }]);

      await sendConfirmationCard(
        channelId,
        result.content,
        result.pending_actions,
        result.conversationId
      );
    }
  } catch (err) {
    console.error('Slack chat error:', err.message);
    await say('Something went wrong. Try again.');
  }
});

// ─── HANDLE CONFIRM BUTTON ────────────────────────────────────────────────────

app.action('confirm_action', async ({ body, ack, say }) => {
  await ack();

  const conversationId = body.actions[0].value;
  const slackUserId = body.user.id;

  // Get pending actions
  const { data: pending } = await supabase
    .from('crm_slack_pending')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('slack_user_id', slackUserId)
    .single();

  if (!pending) {
    await say('This action has already been executed or expired.');
    return;
  }

  const crmUser = await getSlackUser(slackUserId);
  if (!crmUser) return;

  // Delete pending row
  await supabase
    .from('crm_slack_pending')
    .delete()
    .eq('conversation_id', conversationId);

  // Execute via aiBrain with confirmed=true
  try {
    const result = await chat(crmUser.id, null, conversationId, 'confirmed');
    await say(`✅ ${result.content}`);
  } catch (err) {
    console.error('Slack confirm error:', err.message);
    await say('Action failed. Check the CRM for details.');
  }
});

// ─── HANDLE CANCEL BUTTON ─────────────────────────────────────────────────────

app.action('cancel_action', async ({ body, ack, say }) => {
  await ack();

  const conversationId = body.actions[0].value;

  await supabase
    .from('crm_slack_pending')
    .delete()
    .eq('conversation_id', conversationId);

  await say('❌ Action cancelled.');
});

// ─── POST NOTIFICATION TO ALERTS CHANNEL ─────────────────────────────────────

async function postAlert(message) {
  try {
    const channel = process.env.SLACK_ALERTS_CHANNEL || '#all-planfor';
    await app.client.chat.postMessage({
      channel,
      text: message,
    });
  } catch (err) {
    console.error('Slack alert failed:', err.message);
  }
}

// ─── START SLACK BOT ──────────────────────────────────────────────────────────

async function startSlackBot() {
  try {
    await app.start();
    console.log('⚡ Chappie Slack bot connected via Socket Mode');
  } catch (err) {
    console.error('❌ Slack bot failed to start:', err.message);
  }
}

module.exports = { startSlackBot, postAlert };