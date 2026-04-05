const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../db');
const { chat } = require('../services/aiBrain');

// POST /api/ai/chat
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, pendingConfirmation } = req.body;
    if (!message && !pendingConfirmation) {
      return res.status(400).json({ error: 'message or pendingConfirmation required' });
    }

    const result = await chat(req.user.id, message, pendingConfirmation, req.body.conversationId || null);
    res.json(result);
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/history
// Each user sees their own — admin sees all
router.get('/history', auth, async (req, res) => {
  try {
    const { agent_id } = req.query;
    const isAdmin = req.user.role === 'admin';

    let query = supabase
      .from('crm_ai_conversations')
      .select('id, user_id, last_message, actions_taken, created_at, updated_at, crm_users!crm_ai_conversations_user_id_fkey(name, email)')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (isAdmin && agent_id) {
      query = query.eq('user_id', agent_id);
    } else if (!isAdmin) {
      query = query.eq('user_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/history/:id — get full conversation messages
router.get('/history/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_ai_conversations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Non-admins can only see their own
    if (data.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/agents — admin only, list of users who have used AI
router.get('/agents', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { data } = await supabase
      .from('crm_ai_conversations')
      .select('user_id, crm_users!crm_ai_conversations_user_id_fkey(id, name, email)')
      .order('updated_at', { ascending: false });

    // Deduplicate by user_id
    const seen = new Set();
    const agents = [];
    (data || []).forEach(row => {
      if (!seen.has(row.user_id)) {
        seen.add(row.user_id);
        agents.push(row.crm_users);
      }
    });

    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ai/history/:id — clear a conversation (start fresh)
router.delete('/history/:id', auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('crm_ai_conversations')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (data.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await supabase
      .from('crm_ai_conversations')
      .delete()
      .eq('id', req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/new-conversation — start a fresh conversation
router.post('/new-conversation', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_ai_conversations')
      .insert([{ user_id: req.user.id, messages: [], actions_taken: [] }])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;