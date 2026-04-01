// server/routes/google.js
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const supabase = require('../db');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// ─── OAUTH CLIENT SETUP ──────────────────────────────────────────────────────

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

// ─── INITIATE OAUTH FLOW ─────────────────────────────────────────────────────

// GET /api/google/connect?type=personal|shared&label=marketing
// Redirects user to Google consent screen
router.get('/connect', auth, async (req, res) => {
  const { type = 'personal', label } = req.query;

  // Only admins can connect shared accounts
  if (type === 'shared' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can connect shared accounts' });
  }

  const oauth2Client = getOAuthClient();

  // Pass user context through state parameter
  const state = JSON.stringify({
    userId: req.user.id,
    type,
    label: label || null,
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });

  res.json({ authUrl });
});

// ─── OAUTH CALLBACK ──────────────────────────────────────────────────────────

// GET /api/google/callback?code=...&state=...
// Google redirects here after user approves
router.get('/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(`${getClientUrl()}/settings?google=error&reason=${oauthError}`);
  }

  if (!code || !state) {
    return res.redirect(`${getClientUrl()}/settings?google=error&reason=missing_params`);
  }

  try {
    const { userId, type, label } = JSON.parse(state);
    const oauth2Client = getOAuthClient();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get the Google email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    const googleEmail = profile.email;

    // Check if this Google account is already connected by this user
    const { data: existing } = await supabase
      .from('crm_google_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('email', googleEmail)
      .single();

    if (existing) {
      // Update existing connection with fresh tokens
      await supabase
        .from('crm_google_accounts')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || undefined,
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scopes: SCOPES.join(' '),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new connection
      await supabase
        .from('crm_google_accounts')
        .insert([{
          user_id: userId,
          email: googleEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          account_type: type,
          label: label || (type === 'shared' ? 'Marketing' : null),
          scopes: SCOPES.join(' '),
          is_active: true,
        }]);
    }

    res.redirect(`${getClientUrl()}/settings?google=success&email=${encodeURIComponent(googleEmail)}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${getClientUrl()}/settings?google=error&reason=token_exchange_failed`);
  }
});

// ─── LIST CONNECTED ACCOUNTS ─────────────────────────────────────────────────

// GET /api/google/accounts
router.get('/accounts', auth, async (req, res) => {
  try {
    let query = supabase
      .from('crm_google_accounts')
      .select('id, user_id, email, account_type, label, is_active, created_at, updated_at, crm_users(name)')
      .order('created_at', { ascending: false });

    // Non-admins only see their own + shared accounts
    if (req.user.role !== 'admin') {
      query = query.or(`user_id.eq.${req.user.id},account_type.eq.shared`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET MY CONNECTED ACCOUNT ────────────────────────────────────────────────

// GET /api/google/my-account
router.get('/my-account', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_google_accounts')
      .select('id, email, account_type, label, is_active, created_at')
      .eq('user_id', req.user.id)
      .eq('account_type', 'personal')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DISCONNECT ACCOUNT ──────────────────────────────────────────────────────

// DELETE /api/google/accounts/:id
router.delete('/accounts/:id', auth, async (req, res) => {
  try {
    // Fetch the account first
    const { data: account, error: fetchErr } = await supabase
      .from('crm_google_accounts')
      .select('id, user_id, account_type, access_token')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Only the owner or admin can disconnect
    if (account.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only admins can disconnect shared accounts
    if (account.account_type === 'shared' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can disconnect shared accounts' });
    }

    // Revoke the Google token
    try {
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials({ access_token: account.access_token });
      await oauth2Client.revokeToken(account.access_token);
    } catch (revokeErr) {
      // Token may already be expired/revoked — continue with deletion
      console.warn('Token revocation failed (may already be revoked):', revokeErr.message);
    }

    // Soft-delete: mark as inactive
    await supabase
      .from('crm_google_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', account.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TOKEN REFRESH HELPER ────────────────────────────────────────────────────

// This is exported for use by other services (Gmail send, sync, calendar)
async function getValidToken(googleAccountId) {
  const { data: account, error } = await supabase
    .from('crm_google_accounts')
    .select('*')
    .eq('id', googleAccountId)
    .eq('is_active', true)
    .single();

  if (error || !account) throw new Error('Google account not found or inactive');

  const now = new Date();
  const expiry = new Date(account.token_expiry);

  // If token expires in less than 5 minutes, refresh it
  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ refresh_token: account.refresh_token });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      await supabase
        .from('crm_google_accounts')
        .update({
          access_token: credentials.access_token,
          token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      return {
        ...account,
        access_token: credentials.access_token,
        token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : account.token_expiry,
      };
    } catch (refreshErr) {
      // Mark account as inactive if refresh fails
      await supabase
        .from('crm_google_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', account.id);
      throw new Error('Token refresh failed — account disconnected');
    }
  }

  return account;
}

// Helper: get authenticated OAuth client for a specific account
async function getAuthenticatedClient(googleAccountId) {
  const account = await getValidToken(googleAccountId);
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });
  return { oauth2Client, account };
}

// Helper: get client URL for redirects
function getClientUrl() {
  return process.env.CLIENT_URL || 'http://localhost:3000';
}

router.getValidToken = getValidToken;
router.getAuthenticatedClient = getAuthenticatedClient;
router.getOAuthClient = getOAuthClient;

module.exports = router;