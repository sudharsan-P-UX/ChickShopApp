const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid Username or Password' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid Username or Password' });

    // Fetch role permissions
    const roleQuery = await db.query('SELECT permissions FROM roles WHERE role_name = $1', [user.role]);
    const permissions = roleQuery.rows.length > 0 ? roleQuery.rows[0].permissions : null;

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, permissions } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.register = async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hash, role || 'cashier']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, username, role FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const roleCheck = await db.query('SELECT 1 FROM roles WHERE role_name = $1', [role]);
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid role. Role does not exist in system.' });
    }

    const { rowCount, rows } = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, id]
    );

    if (rowCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;
  try {
    const existing = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    
    let hash = existing.rows[0].password_hash;
    if (password && password.trim().length > 0) {
      hash = await bcrypt.hash(password, 10);
    }
    
    const finalUsername = username && username.trim().length > 0 ? username.trim() : existing.rows[0].username;
    const finalRole = role && role.trim().length > 0 ? role.trim() : existing.rows[0].role;
    
    if (finalRole !== existing.rows[0].role) {
      const roleCheck = await db.query('SELECT 1 FROM roles WHERE role_name = $1', [finalRole]);
      if (roleCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid role. Role does not exist in system.' });
      }
    }
    
    const { rows } = await db.query(
      'UPDATE users SET username = $1, password_hash = $2, role = $3 WHERE id = $4 RETURNING id, username, role',
      [finalUsername, hash, finalRole, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own admin user' });
    }

    const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listRoles = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRole = async (req, res) => {
  const { role_name } = req.body;
  if (!role_name || role_name.trim() === '') {
    return res.status(400).json({ message: 'Role name is required' });
  }

  const normalized = role_name.trim().toLowerCase();
  
  // Default permissions for new custom roles (copy cashier style)
  const defaultPerms = {
    billing: { view: true, add: true, edit: false, delete: false },
    cart: { view: true, add: false, edit: false, delete: false },
    pending: { view: true, add: false, edit: false, delete: false },
    dashboard: { view: false, add: false, edit: false, delete: false },
    inventory: { view: false, add: false, edit: false, delete: false },
    customers: { view: true, add: true, edit: false, delete: false },
    users: { view: false, add: false, edit: false, delete: false },
    custom_labels: { view: false, add: false, edit: false, delete: false }
  };

  try {
    const { rows } = await db.query(
      'INSERT INTO roles (role_name, permissions) VALUES ($1, $2) RETURNING *',
      [normalized, JSON.stringify(defaultPerms)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Role already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT role_name FROM roles WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Role not found' });
    
    const roleName = rows[0].role_name;
    if (roleName === 'admin' || roleName === 'cashier') {
      return res.status(400).json({ message: 'Cannot delete default roles admin or cashier' });
    }

    await db.query('DELETE FROM roles WHERE id = $1', [id]);
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRolePermissions = async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  if (!permissions) {
    return res.status(400).json({ message: 'Permissions object is required' });
  }

  try {
    const { rows } = await db.query(
      'UPDATE roles SET permissions = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(permissions), id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Role not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
