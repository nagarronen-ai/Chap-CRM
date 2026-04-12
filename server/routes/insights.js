// server/routes/insights.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const { generateTeamInsight, getLatestInsight } = require('../services/teamBrain');

// GET latest insight
router.get('/latest', auth, async (req, res) => {
  const insight = await getLatestInsight();
  if (!insight) return res.json(null);
  res.json(insight);
});

// POST generate now (admin only)
router.post('/generate', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const insight = await generateTeamInsight();
  if (!insight) return res.status(500).json({ error: 'No thoughts available or generation failed' });
  res.json(insight);
});

module.exports = router;