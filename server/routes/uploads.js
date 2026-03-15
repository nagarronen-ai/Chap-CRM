// server/routes/uploads.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');

// Store files in memory temporarily before uploading to Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Upload a file to a specific bucket
router.post('/:bucket', auth, upload.single('file'), async (req, res) => {
  const { bucket } = req.params;
  const allowedBuckets = ['client-documents', 'receipts'];

  if (!allowedBuckets.includes(bucket)) {
    return res.status(400).json({ error: 'Invalid bucket' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const timestamp = Date.now();
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${req.user.id}/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }

  // Get the public/signed URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  // If bucket is private, create a signed URL instead
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

  const fileUrl = signedData?.signedUrl || urlData?.publicUrl || '';

  res.json({
    url: fileUrl,
    path: filePath,
    bucket,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
  });
});

// Delete a file from a bucket
router.delete('/:bucket', auth, async (req, res) => {
  const { bucket } = req.params;
  const { path } = req.body;

  if (!path) return res.status(400).json({ error: 'No file path provided' });

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;