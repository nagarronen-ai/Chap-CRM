// client/src/hooks/useRole.js

export function useRole() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || 'admin';
  
    const can = (permission) => {
      const PERMISSIONS = {
        'company:edit':    ['admin'],
        'company:delete':  ['admin'],
        'company:assign':  ['admin'],
        'company:export':  ['admin', 'marketing', 'finance'],
        'people:edit':     ['admin', 'sales'],
        'people:delete':   ['admin'],
        'pipeline:move':   ['admin', 'sales'],
        'activity:write':  ['admin', 'sales', 'csm', 'support'],
        'activity:delete': ['admin'],
        'email:send':      ['admin', 'sales', 'csm'],
        'email:templates': ['admin', 'sales', 'marketing', 'csm'],
        'import:run':      ['admin', 'sales', 'marketing'],
        'finance:general': ['admin', 'finance'],
        'finance:company': ['admin', 'csm', 'support', 'finance'],
        'users:manage':    ['admin'],
      };
      return (PERMISSIONS[permission] || []).includes(role);
    };
  
    const is = (...roles) => roles.includes(role);
  
    return { role, can, is };
  }