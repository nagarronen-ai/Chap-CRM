// server/middleware/rbac.js
const supabase = require('../db');

// ─── PERMISSION CACHE (5 min TTL) ────────────────────────────────────────────
const permCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getRolePermissions(roleName) {
  const cached = permCache.get(roleName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.perms;

  const { data: role } = await supabase
    .from('crm_roles')
    .select('*, crm_permissions(*)')
    .eq('name', roleName)
    .single();

  if (!role) return new Set();

  const perms = new Set(
    (role.crm_permissions || [])
      .filter(p => p.enabled)
      .map(p => `${p.module}:${p.action}`)
  );

  permCache.set(roleName, { perms, ts: Date.now() });
  return perms;
}

// Clear cache when permissions are updated
function clearPermissionCache(roleName) {
  if (roleName) permCache.delete(roleName);
  else permCache.clear();
}

// ─── LEGACY KEY → NEW MODULE:ACTION MAP ──────────────────────────────────────
const LEGACY_MAP = {
  'company:edit':      'contacts:edit',
  'company:delete':    'contacts:delete',
  'company:assign':    'contacts:edit',
  'company:export':    'contacts:view',
  'people:edit':       'contacts:edit',
  'people:delete':     'contacts:delete',
  'pipeline:move':     'pipeline:change_stage',
  'activity:write':    'pipeline:edit',
  'activity:delete':   'pipeline:delete',
  'email:send':        'emails:send',
  'email:templates':   'emails:manage_templates',
  'import:run':        'import:use',
  'finance:general':   'finance:view',
  'finance:company':   'finance:view',
  'users:manage':      'team:invite',
  'marketing:send':    'marketing:send_campaign',
  'marketing:view':    'marketing:view',
};

// ─── CHECK PERMISSION MIDDLEWARE ──────────────────────────────────────────────
const checkPermission = (permission) => async (req, res, next) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  // Admin always passes
  if (role === 'admin') return next();

  try {
    const perms = await getRolePermissions(role);
    
    // Resolve permission key — try new format first, then legacy map
    const resolvedPerm = LEGACY_MAP[permission] || permission;
    
    if (perms.has(resolvedPerm)) return next();

    return res.status(403).json({ error: 'Forbidden', role, permission });
  } catch (err) {
    console.error('rbac error:', err.message);
    return res.status(403).json({ error: 'Forbidden' });
  }
};

// ─── CHECK ROLE MIDDLEWARE ────────────────────────────────────────────────────
const checkRole = (allowedRoles) => (req, res, next) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (!allowedRoles.includes(role)) return res.status(403).json({ error: 'Forbidden', role });
  next();
};

// ─── COMPANY FILTER ───────────────────────────────────────────────────────────
const getCompanyFilter = (userId, role) => {
  if (['sales', 'csm'].includes(role)) return { assigned_to: userId };
  return {};
};

module.exports = { checkPermission, checkRole, getCompanyFilter, clearPermissionCache };