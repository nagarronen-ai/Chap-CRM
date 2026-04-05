const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

// GET /api/thoughts — get my thoughts
router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_thoughts')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/thoughts — create thought
router.post('/', auth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const { data, error } = await supabase
    .from('crm_thoughts')
    .insert([{ user_id: req.user.id, content }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/thoughts/:id — update thought
router.put('/:id', auth, async (req, res) => {
  const { content } = req.body;
  const { data, error } = await supabase
    .from('crm_thoughts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/thoughts/:id — delete thought
router.delete('/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('crm_thoughts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/thoughts/:id/chat — get conversation for thought
router.get('/:id/chat', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_thought_conversations')
    .select('*')
    .eq('thought_id', req.params.id)
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  res.json(data || { messages: [] });
});

// POST /api/thoughts/:id/chat — send message to Claude about this thought
router.post('/:id/chat', auth, async (req, res) => {
    const { message, model } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

  // Get the thought
  const { data: thought } = await supabase
    .from('crm_thoughts')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (!thought) return res.status(404).json({ error: 'Thought not found' });

  // Get existing conversation
  let { data: conv } = await supabase
    .from('crm_thought_conversations')
    .select('*')
    .eq('thought_id', req.params.id)
    .single();

  const history = conv?.messages || [];

  // Build messages for Claude
  const messages = [
    ...history,
    { role: 'user', content: message },
  ];

  // Call Claude API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are a strategic thinking partner for a CEO. The user is brainstorming an idea. 
The original thought is: "${thought.content}"
Be direct, insightful and concise. Help them think through the idea, challenge assumptions, identify opportunities and risks, and help extract action plans when asked.
If the user asks for CRM context, let them know they can ask Chappie (the CRM AI) directly for that data.`,
      messages,
    }),
  });

  const data = await response.json();
  const raw = data.content?.[0]?.text || 'Sorry, I could not generate a response.';
  const reply = raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .trim();

  // Save updated conversation
  const updatedMessages = [
    ...history,
    { role: 'user', content: message },
    { role: 'assistant', content: reply },
  ];

  if (conv) {
    await supabase
      .from('crm_thought_conversations')
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq('id', conv.id);
  } else {
    await supabase
      .from('crm_thought_conversations')
      .insert([{ thought_id: req.params.id, messages: updatedMessages }]);
  }

  res.json({ reply, messages: updatedMessages });
});

module.exports = router;