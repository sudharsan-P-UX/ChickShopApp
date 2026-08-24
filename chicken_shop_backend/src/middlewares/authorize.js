const db = require('../config/db');

module.exports = (menu, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Access Denied: Unauthenticated' });
      }

      // 1. Fetch user permissions first from users table
      const userRes = await db.query('SELECT permissions, role FROM users WHERE id = $1', [req.user.id]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ message: 'Access Denied: User not found.' });
      }

      const userRecord = userRes.rows[0];
      const role = userRecord.role;
      if (role === 'super_admin' || role === 'superadmin') {
        return next();
      }

      // Fetch permissions for this role from the database
      const roleRes = await db.query('SELECT permissions FROM roles WHERE role_name = $1', [role]);
      if (roleRes.rows.length === 0) {
        return res.status(403).json({ message: `Access Denied: Role '${role}' not found in database.` });
      }

      const permissions = roleRes.rows[0].permissions;

      // Verify that this role has the requested permission
      if (!permissions || !permissions[menu] || !permissions[menu][action]) {
        return res.status(403).json({ message: `Access Denied: Insufficient privileges to perform ${action} on ${menu}.` });
      }

      next();
    } catch (err) {
      console.error('RBAC Authorize error:', err);
      res.status(500).json({ error: err.message });
    }
  };
};
