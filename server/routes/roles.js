// server/routes/roles.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// ─── GET ALL ROLES WITH PERMISSIONS ──────────────────────────────────────────

router.get('/', auth, adminOnly, async (req, res) => {
  const { data: roles, error } = await supabase
    .from('crm_roles')
    .select('*, crm_permissions(*)')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(roles);
});

// ─── GET PERMISSIONS FOR CURRENT USER'S ROLE ─────────────────────────────────

router.get('/my-permissions', auth, async (req, res) => {
  const { data: role, error } = await supabase
    .from('crm_roles')
    .select('*, crm_permissions(*)')
    .eq('name', req.user.role)
    .single();

  if (error || !role) return res.json({ permissions: [] });
  res.json({ role: role.name, permissions: role.crm_permissions });
});

// ─── CREATE ROLE ──────────────────────────────────────────────────────────────

router.post('/', auth, adminOnly, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const { data, error } = await supabase
    .from('crm_roles')
    .insert([{ name: name.toLowerCase().trim(), description, is_system: false }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Seed all permissions as disabled for new role
  const allPermissions = [
    ['pipeline', 'view'], ['pipeline', 'create'], ['pipeline', 'edit'], ['pipeline', 'delete'], ['pipeline', 'change_stage'],
    ['contacts', 'view'], ['contacts', 'create'], ['contacts', 'edit'], ['contacts', 'delete'],
    ['clients', 'view'], ['clients', 'create'], ['clients', 'edit'], ['clients', 'delete'],
    ['emails', 'view'], ['emails', 'send'], ['emails', 'delete'], ['emails', 'manage_templates'],
    ['inbox', 'view'],
    ['calendar', 'view'], ['calendar', 'create'], ['calendar', 'edit'], ['calendar', 'delete'],
    ['marketing', 'view'], ['marketing', 'create'], ['marketing', 'send_campaign'], ['marketing', 'manage_drip'], ['marketing', 'view_waitlist'], ['marketing', 'export'],
    ['finance', 'view'], ['finance', 'create'], ['finance', 'edit'], ['finance', 'delete'],
    ['ai_assistant', 'view'], ['ai_assistant', 'use'],
    ['thoughts', 'view'], ['thoughts', 'use'],
    ['team', 'view'], ['team', 'invite'], ['team', 'edit_roles'], ['team', 'delete_users'],
    ['settings', 'view'], ['settings', 'edit'],
    ['import', 'use'],
  ];

  await supabase.from('crm_permissions').insert(
    allPermissions.map(([module, action]) => ({
      role_id: data.id,
      module,
      action,
      enabled: false,
    }))
  );

  const { data: full } = await supabase
    .from('crm_roles')
    .select('*, crm_permissions(*)')
    .eq('id', data.id)
    .single();

  res.json(full);
});

// ─── UPDATE ROLE NAME/DESCRIPTION ────────────────────────────────────────────

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, description } = req.body;

  const { data, error } = await supabase
    .from('crm_roles')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── UPDATE PERMISSIONS FOR A ROLE ───────────────────────────────────────────

router.put('/:id/permissions', auth, adminOnly, async (req, res) => {
    const { permissions } = req.body;
    console.log('Saving permissions for role_id:', req.params.id, 'count:', permissions?.length);
    console.log('Sample:', JSON.stringify(permissions?.slice(0, 2)));

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions array required' });
    }
  
    for (const p of permissions) {
        const { error } = await supabase
          .from('crm_permissions')
          .upsert({
            role_id: req.params.id,
            module: p.module,
            action: p.action,
            enabled: p.enabled,
          }, { onConflict: 'role_id,module,action' });
        if (error) console.error('Permission upsert error:', p.module, p.action, error.message);
      }

  const { clearPermissionCache } = require('../middleware/rbac');
  clearPermissionCache();

  const { data } = await supabase
    .from('crm_roles')
    .select('*, crm_permissions(*)')
    .eq('id', req.params.id)
    .single();

  res.json(data);
});

// ─── DELETE ROLE (non-system only) ───────────────────────────────────────────

router.delete('/:id', auth, adminOnly, async (req, res) => {
  const { data: role } = await supabase
    .from('crm_roles')
    .select('is_system')
    .eq('id', req.params.id)
    .single();

  if (role?.is_system) return res.status(403).json({ error: 'Cannot delete a system role' });

  await supabase.from('crm_permissions').delete().eq('role_id', req.params.id);
  await supabase.from('crm_roles').delete().eq('id', req.params.id);

  res.json({ success: true });
});

module.exports = router;