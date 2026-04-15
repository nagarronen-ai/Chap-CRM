// server/routes/settings.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/settings — get current settings
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      // No settings yet — return defaults
      return res.json({
        company_name: '',
        industry: '',
        what_you_sell: '',
        business_type: 'b2b',
        team_size: '',
        primary_color: '#8E9B8B',
        logo_url: null,
        onboarding_completed: false,
      });
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update settings (admin only)
router.put('/', auth, async (req, res) => {
  try {
    const { company_name, industry, what_you_sell, business_type, team_size, primary_color, palette, logo_url, onboarding_completed } = req.body;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('crm_settings')
      .select('id')
      .limit(1)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('crm_settings')
        .update({
          company_name,
          industry,
          what_you_sell,
          business_type,
          team_size,
          primary_color,
          palette,
          logo_url,
          onboarding_completed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('crm_settings')
        .insert([{
          company_name,
          industry,
          what_you_sell,
          business_type,
          team_size,
          primary_color,
          palette,
          logo_url,
          onboarding_completed,
        }])
        .select()
        .single();
    }

    if (result.error) return res.status(500).json({ error: result.error.message });
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/logo — upload logo
router.post('/logo', auth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const timestamp = Date.now();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `logos/${timestamp}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: signedData } = await supabase.storage
      .from('receipts')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10); // 10 years

    res.json({ url: signedData?.signedUrl || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;