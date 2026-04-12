// server/routes/documents.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/documents?company_id=x or ?client_id=x or both
router.get('/', auth, async (req, res) => {
    try {
      const { company_id, client_id } = req.query;
      if (!company_id && !client_id) return res.status(400).json({ error: 'company_id or client_id required' });
  
      let data = [];
  
      if (client_id && company_id) {
        // Fetch both and merge — client docs + contact docs
        const [clientDocs, companyDocs] = await Promise.all([
          supabase.from('crm_documents').select('*, uploaded_by_user:crm_users!uploaded_by(name)').eq('client_id', client_id).order('created_at', { ascending: false }),
          supabase.from('crm_documents').select('*, uploaded_by_user:crm_users!uploaded_by(name)').eq('company_id', company_id).order('created_at', { ascending: false }),
        ]);
        const merged = [
          ...(clientDocs.data || []),
          ...(companyDocs.data || []).filter(d => !(clientDocs.data || []).find(c => c.id === d.id)),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        data = merged;
      } else {
        let query = supabase
          .from('crm_documents')
          .select('*, uploaded_by_user:crm_users!uploaded_by(name)')
          .order('created_at', { ascending: false });
        if (company_id) query = query.eq('company_id', company_id);
        if (client_id) query = query.eq('client_id', client_id);
        const { data: result, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        data = result;
      }
  
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// POST /api/documents/upload
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { company_id, client_id, title, type, notes } = req.body;
    if (!company_id && !client_id) return res.status(400).json({ error: 'company_id or client_id required' });

    // Upload to Supabase Storage
    const fileName = `${req.user.id}/${Date.now()}_${req.file.originalname.replace(/\s/g, '_')}`;
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(`documents/${fileName}`, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: urlData } = await supabase.storage
      .from('receipts')
      .createSignedUrl(`documents/${fileName}`, 60 * 60 * 24 * 365);

    const fileUrl = urlData?.signedUrl;
    if (!fileUrl) return res.status(500).json({ error: 'Failed to get file URL' });

    // Save to DB
    const { data, error } = await supabase
      .from('crm_documents')
      .insert([{
        title: title || req.file.originalname,
        file_url: fileUrl,
        type: type || 'Other',
        notes: notes || null,
        company_id: company_id || null,
        client_id: client_id || null,
        uploaded_by: req.user.id,
      }])
      .select('*, uploaded_by_user:crm_users!uploaded_by(name)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('crm_documents')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/documents/:id — update title/type/notes
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, type, notes } = req.body;
    const { data, error } = await supabase
      .from('crm_documents')
      .update({ title, type, notes })
      .eq('id', req.params.id)
      .select('*, uploaded_by_user:crm_users!uploaded_by(name)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;