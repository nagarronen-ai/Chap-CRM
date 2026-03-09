// server/middleware/rbac.js

const PERMISSIONS = {
    'company:edit':        ['admin'],
    'company:delete':      ['admin'],
    'company:assign':      ['admin'],
    'company:export':      ['admin', 'marketing', 'finance'],
    'people:edit':         ['admin', 'sales'],
    'people:delete':       ['admin'],
    'pipeline:move':       ['admin', 'sales'],
    'activity:write':      ['admin', 'sales', 'csm', 'support'],
    'activity:delete':     ['admin'],
    'email:send':      ['admin', 'sales', 'marketing', 'csm', 'support', 'finance'],
    'email:templates':     ['admin', 'sales', 'marketing', 'csm', 'support', 'finance'],
    'import:run':          ['admin', 'sales', 'marketing'],
    'finance:general':     ['admin', 'finance'],
    'finance:company':     ['admin', 'csm', 'support', 'finance'],
    'users:manage':        ['admin'],
  };
  
  const checkPermission = (permission) => (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    const allowed = PERMISSIONS[permission] || [];
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'Forbidden', role, permission });
    }
    next();
  };
  
  const checkRole = (allowedRoles) => (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden', role });
    }
    next();
  };
  
  // Sales + CSM only see their own assigned companies
  const getCompanyFilter = (userId, role) => {
    if (['sales', 'csm'].includes(role)) return { assigned_to: userId };
    return {};
  };
  
  module.exports = { PERMISSIONS, checkPermission, checkRole, getCompanyFilter };