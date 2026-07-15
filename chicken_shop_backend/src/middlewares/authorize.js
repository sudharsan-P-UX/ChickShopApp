const db = require('../config/db');

module.exports = (menu, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Access Denied: Unauthenticated' });
      }

      const role = req.user.role;

      // Fetch permissions for this role from the database
      const { rows } = await db.query('SELECT permissions FROM roles WHERE role_name = $1', [role]);
      if (rows.length === 0) {
        return res.status(403).json({ message: `Access Denied: Role '${role}' not found in database.` });
      }

      const permissions = rows[0].permissions;

      // Verify that this role has the requested permission
      if (!permissions || !permissions[menu] || !permissions[menu][action]) {
        return res.status(403).json({ message: `Access Denied: Insufficient permissions to perform ${action} on ${menu}.` });
      }

      next();
    } catch (err) {
      console.error('RBAC Authorize error:', err);
      res.status(500).json({ error: err.message });
    }
  };
};
