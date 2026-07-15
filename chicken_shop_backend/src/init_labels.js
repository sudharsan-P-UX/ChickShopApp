require('dotenv').config();
const db = require('./config/db');

const defaultLabels = [
  // Billing & POS
  { menu_key: 'billing', label_key: 'billing_menu', label_name: 'Billing & POS', custom_label: 'Billing & POS' },
  { menu_key: 'billing', label_key: 'view_cart', label_name: 'View Cart', custom_label: 'View Cart' },
  { menu_key: 'billing', label_key: 'add_button', label_name: 'Add', custom_label: 'Add' },
  { menu_key: 'billing', label_key: 'out_of_stock', label_name: 'Out of Stock', custom_label: 'Out of Stock' },
  { menu_key: 'billing', label_key: 'pending_orders', label_name: 'Pending Orders', custom_label: 'Pending Orders' },

  // Overview
  { menu_key: 'overview', label_key: 'overview_menu', label_name: 'Overview', custom_label: 'Overview' },
  { menu_key: 'overview', label_key: 'total_revenue', label_name: 'Total Revenue', custom_label: 'Total Revenue' },
  { menu_key: 'overview', label_key: 'completed_bills', label_name: 'Completed Bills', custom_label: 'Completed Bills' },
  { menu_key: 'overview', label_key: 'low_stock_alert', label_name: 'Low Stock Alert', custom_label: 'Low Stock Alert' },
  { menu_key: 'overview', label_key: 'registered_customers', label_name: 'Registered Customers', custom_label: 'Registered Customers' },

  // Inventory
  { menu_key: 'inventory', label_key: 'inventory_menu', label_name: 'Inventory Control', custom_label: 'Inventory Control' },

  // Customers
  { menu_key: 'customers', label_key: 'customers_menu', label_name: 'Customer Directory', custom_label: 'Customer Directory' },

  // Users
  { menu_key: 'users', label_key: 'users_menu', label_name: 'User Management', custom_label: 'User Management' },

  // Custom Label
  { menu_key: 'custom_labels', label_key: 'custom_labels_menu', label_name: 'Custom Label', custom_label: 'Custom Label' },
  { menu_key: 'custom_labels', label_key: 'app_logo', label_name: 'App Logo Image', custom_label: '' }
];

async function run() {
  try {
    console.log('Creating custom_labels table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_labels (
        id SERIAL PRIMARY KEY,
        menu_key VARCHAR(100) NOT NULL,
        label_key VARCHAR(100) UNIQUE NOT NULL,
        label_name VARCHAR(255) NOT NULL,
        custom_label VARCHAR(255) NOT NULL
      );
    `);

    console.log('Seeding default custom labels...');
    for (const item of defaultLabels) {
      await db.query(`
        INSERT INTO custom_labels (menu_key, label_key, label_name, custom_label)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (label_key) DO NOTHING
      `, [item.menu_key, item.label_key, item.label_name, item.custom_label]);
    }
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding DB:', err);
    process.exit(1);
  }
}

run();
