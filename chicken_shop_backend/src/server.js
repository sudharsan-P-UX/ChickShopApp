require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const billingRoutes = require('./routes/billingRoutes');
const labelRoutes = require('./routes/labelRoutes');
const menuRoutes = require('./routes/menuRoutes');

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

app.use('/api/menus', menuRoutes);
app.use('/menus', menuRoutes);


// Dynamic self-healing super_admin and admin roles/users seeding
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function initSuperAdmin() {
  try {
    // 1. Ensure roles and users tables have permissions columns if not already
    await db.query('ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions JSONB');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB');

    // Run schema migrations for Custom Bill features
    await db.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_custom_bill BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE inventory ALTER COLUMN qty TYPE DECIMAL(10, 2)');
    await db.query('ALTER TABLE pending_bills ADD COLUMN IF NOT EXISTS is_custom_bill BOOLEAN DEFAULT FALSE');

    // Run schema migrations for Menu Order features
    await db.query(`
      CREATE TABLE IF NOT EXISTS menu_order (
        id SERIAL PRIMARY KEY,
        main_menu VARCHAR(100) NOT NULL,
        submenu_key VARCHAR(100) UNIQUE NOT NULL,
        submenu_name VARCHAR(150) NOT NULL,
        display_order INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Seed default menus if any are missing
    const defaultMenus = [
      { main_menu: 'Create Billing', submenu_key: 'billing', submenu_name: 'Billing & POS', display_order: 1, is_active: true },
      { main_menu: 'Create Billing', submenu_key: 'custom_bill', submenu_name: 'Custom Bill', display_order: 2, is_active: true },
      { main_menu: 'Cart', submenu_key: 'cart', submenu_name: 'View Cart', display_order: 1, is_active: true },
      { main_menu: 'Cart', submenu_key: 'custom_cart', submenu_name: 'View Custom Cart', display_order: 2, is_active: true },
      { main_menu: 'Orders', submenu_key: 'pending', submenu_name: 'Pending Orders', display_order: 1, is_active: true },
      { main_menu: 'Orders', submenu_key: 'custom_pending', submenu_name: 'Custom Pending Orders', display_order: 2, is_active: true },
      { main_menu: 'Dashboards', submenu_key: 'dashboard', submenu_name: 'Overview', display_order: 1, is_active: true },
      { main_menu: 'Customer', submenu_key: 'customers', submenu_name: 'Customer Directory', display_order: 1, is_active: true },
      { main_menu: 'Admin', submenu_key: 'users', submenu_name: 'User Management', display_order: 1, is_active: true },
      { main_menu: 'Admin', submenu_key: 'inventory', submenu_name: 'Inventory Control', display_order: 2, is_active: true },
      { main_menu: 'Admin', submenu_key: 'custom_bill_inventory', submenu_name: 'Custom Bill Inventory', display_order: 3, is_active: true },
      { main_menu: 'Admin', submenu_key: 'custom_labels', submenu_name: 'Custom Label', display_order: 4, is_active: true },
      { main_menu: 'Admin', submenu_key: 'menu_control', submenu_name: 'Menu Control', display_order: 5, is_active: true },
      { main_menu: 'Admin', submenu_key: 'menu_order', submenu_name: 'Menu Order', display_order: 6, is_active: true }
    ];
    for (const m of defaultMenus) {
      const existCheck = await db.query("SELECT 1 FROM menu_order WHERE submenu_key = $1", [m.submenu_key]);
      if (existCheck.rows.length === 0) {
        console.log(`Seeding missing menu: ${m.submenu_name}`);
        await db.query(
          "INSERT INTO menu_order (main_menu, submenu_key, submenu_name, display_order, is_active) VALUES ($1, $2, $3, $4, $5)",
          [m.main_menu, m.submenu_key, m.submenu_name, m.display_order, m.is_active]
        );
      }
    }

    // 2. Seed and merge role permissions dynamically
    const rolesToSeed = ['super_admin', 'admin'];
    const defaultPermsMap = {
      super_admin: {
        billing: { view: true, add: true, edit: true, delete: true },
        cart: { view: true, add: true, edit: true, delete: true },
        pending: { view: true, add: true, edit: true, delete: true },
        dashboard: { view: true, add: true, edit: true, delete: true },
        inventory: { view: true, add: true, edit: true, delete: true },
        customers: { view: true, add: true, edit: true, delete: true },
        users: { view: true, add: true, edit: true, delete: true },
        custom_labels: { view: true, add: true, edit: true, delete: true },
        custom_bill: { view: true, add: true, edit: true, delete: true },
        custom_bill_inventory: { view: true, add: true, edit: true, delete: true },
        menu_control: { view: true, add: true, edit: true, delete: true },
        menu_order: { view: true, add: true, edit: true, delete: true }
      },
      admin: {
        billing: { view: true, add: true, edit: true, delete: true },
        cart: { view: true, add: true, edit: true, delete: true },
        pending: { view: true, add: true, edit: true, delete: true },
        dashboard: { view: true, add: true, edit: true, delete: true },
        inventory: { view: true, add: true, edit: true, delete: true },
        customers: { view: true, add: true, edit: true, delete: true },
        users: { view: true, add: true, edit: true, delete: true },
        custom_labels: { view: true, add: true, edit: true, delete: true },
        custom_bill: { view: true, add: true, edit: true, delete: true },
        custom_bill_inventory: { view: true, add: true, edit: true, delete: true },
        menu_control: { view: true, add: true, edit: true, delete: true },
        menu_order: { view: true, add: true, edit: true, delete: true }
      }
    };

    for (const roleName of rolesToSeed) {
      const check = await db.query("SELECT permissions FROM roles WHERE role_name = $1", [roleName]);
      if (check.rows.length === 0) {
        console.log(`Seeding missing role: ${roleName}`);
        await db.query(
          "INSERT INTO roles (role_name, permissions) VALUES ($1, $2)",
          [roleName, JSON.stringify(defaultPermsMap[roleName])]
        );
      } else {
        const currentPerms = check.rows[0].permissions || {};
        let updated = false;
        const targetPerms = defaultPermsMap[roleName];
        
        for (const menuKey of Object.keys(targetPerms)) {
          if (!currentPerms[menuKey]) {
            currentPerms[menuKey] = { ...targetPerms[menuKey] };
            updated = true;
          } else {
            for (const act of Object.keys(targetPerms[menuKey])) {
              if (currentPerms[menuKey][act] === undefined) {
                currentPerms[menuKey][act] = targetPerms[menuKey][act];
                updated = true;
              }
            }
          }
        }
        if (updated) {
          console.log(`Updating permissions for role: ${roleName}`);
          await db.query(
            "UPDATE roles SET permissions = $1 WHERE role_name = $2",
            [JSON.stringify(currentPerms), roleName]
          );
        }
      }
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
