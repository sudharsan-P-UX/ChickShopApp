require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const billingRoutes = require('./routes/billingRoutes');
const labelRoutes = require('./routes/labelRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files for inventory images and frontend client
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// API routes (supports both /api prefix and stripped paths for Vercel compatibility)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/customers', customerRoutes);
app.use('/customers', customerRoutes);

app.use('/api/inventory', inventoryRoutes);
app.use('/inventory', inventoryRoutes);

app.use('/api/billing', billingRoutes);
app.use('/billing', billingRoutes);

app.use('/api/custom-labels', labelRoutes);
app.use('/custom-labels', labelRoutes);


// Dynamic self-healing super_admin and admin roles/users seeding
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function initSuperAdmin() {
  try {
    // 1. Ensure roles table has permissions column if not already
    await db.query('ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions JSONB');

    // 2. Ensure super_admin role exists in roles table
    const superAdminRoleCheck = await db.query("SELECT 1 FROM roles WHERE role_name = 'super_admin'");
    if (superAdminRoleCheck.rows.length === 0) {
      console.log("Seeding 'super_admin' role...");
      const superPerms = {
        billing: { view: true, add: true, edit: true, delete: true },
        cart: { view: true, add: true, edit: true, delete: true },
        pending: { view: true, add: true, edit: true, delete: true },
        dashboard: { view: true, add: true, edit: true, delete: true },
        inventory: { view: true, add: true, edit: true, delete: true },
        customers: { view: true, add: true, edit: true, delete: true },
        users: { view: true, add: true, edit: true, delete: true },
        custom_labels: { view: true, add: true, edit: true, delete: true }
      };
      await db.query(
        "INSERT INTO roles (role_name, permissions) VALUES ('super_admin', $1)",
        [JSON.stringify(superPerms)]
      );
    }

    // 3. Ensure superadmin user exists in users table
    const superAdminUserCheck = await db.query("SELECT 1 FROM users WHERE username = 'superadmin'");
    if (superAdminUserCheck.rows.length === 0) {
      console.log("Seeding 'superadmin' user...");
      const hash = await bcrypt.hash('admin123', 10);
      await db.query(
        "INSERT INTO users (username, password_hash, role) VALUES ('superadmin', $1, 'super_admin')",
        [hash]
      );
    }

    // 4. Ensure admin role has permissions column set if empty
    const adminRoleCheck = await db.query("SELECT permissions FROM roles WHERE role_name = 'admin'");
    if (adminRoleCheck.rows.length > 0 && !adminRoleCheck.rows[0].permissions) {
      const defaultAdminPerms = {
        billing: { view: true, add: true, edit: true, delete: true },
        cart: { view: true, add: true, edit: true, delete: true },
        pending: { view: true, add: true, edit: true, delete: true },
        dashboard: { view: true, add: true, edit: true, delete: true },
        inventory: { view: true, add: true, edit: true, delete: true },
        customers: { view: true, add: true, edit: true, delete: true },
        users: { view: true, add: true, edit: true, delete: true },
        custom_labels: { view: true, add: true, edit: true, delete: true }
      };
      await db.query(
        "UPDATE roles SET permissions = $1 WHERE role_name = 'admin'",
        [JSON.stringify(defaultAdminPerms)]
      );
    }
  } catch (err) {
    console.error('Error seeding super_admin role/user:', err);
  }
}

// Invoke the seeder
initSuperAdmin();

// Export the app for Vercel Serverless Functions
module.exports = app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
