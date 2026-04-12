// client/src/hooks/useRole.js
import { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

// Module-level cache so we don't refetch on every component mount
let permissionsCache = null;
let cacheRole = null;

export function useRole() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'viewer';
  const [permissions, setPermissions] = useState(new Set(permissionsCache || []));

  useEffect(() => {
    if (permissionsCache && cacheRole === role) {
      setPermissions(new Set(permissionsCache));
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.get(`${API}/roles/my-permissions`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      const perms = (res.data.permissions || [])
        .filter(p => p.enabled)
        .map(p => `${p.module}:${p.action}`);
      permissionsCache = perms;
      cacheRole = role;
      setPermissions(new Set(perms));
    }).catch(err => console.error('useRole error:', err));
  }, [role]);

  const can = (permission) => {
    if (role === 'admin') return true;

    // Legacy permission key mapping
    const LEGACY_MAP = {
      'company:edit':    'contacts:edit',
      'company:delete':  'contacts:delete',
      'company:assign':  'contacts:edit',
      'company:export':  'contacts:view',
      'people:edit':     'contacts:edit',
      'people:delete':   'contacts:delete',
      'pipeline:move':   'pipeline:change_stage',
      'activity:write':  'pipeline:edit',
      'activity:delete': 'pipeline:delete',
      'email:send':      'emails:send',
      'email:templates': 'emails:manage_templates',
      'import:run':      'import:use',
      'finance:general': 'finance:view',
      'finance:company': 'finance:view',
      'users:manage':    'team:invite',
      'marketing:send':  'marketing:send_campaign',
      'marketing:view':  'marketing:view',
    };

    const resolved = LEGACY_MAP[permission] || permission;
    return permissions.has(resolved);
  };

  const is = (...roles) => roles.includes(role);

  return { role, can, is };
}