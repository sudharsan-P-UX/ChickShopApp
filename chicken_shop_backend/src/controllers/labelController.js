const db = require('../config/db');
const https = require('https');

// Secure programatic image upload helper using ImgBB
// Falls back to Picsum Photos if no API key is configured
const uploadToImgBB = (base64Data) => {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.warn('IMGBB_API_KEY is not defined, returning fallback placeholder');
    return Promise.resolve('https://picsum.photos/200');
  }
  
  return new Promise((resolve) => {
    // Strip base64 data prefix (e.g. "data:image/png;base64,")
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const postData = new URLSearchParams({
      image: cleanBase64
    }).toString();
    
    const req = https.request(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed && parsed.data && parsed.data.url) {
            resolve(parsed.data.url);
          } else {
            resolve('UPLOAD_ERROR: ImgBB response structure incorrect');
          }
        } catch (e) {
          resolve('UPLOAD_ERROR: ' + e.message);
        }
      });
    });
    
    req.on('error', (err) => {
      resolve('UPLOAD_ERROR: ' + err.message);
    });
    
    req.write(postData);
    req.end();
  });
};

const defaultLabels = [
  // Billing & POS Menu Headers & Buttons
  { menu_key: 'billing', label_key: 'billing_menu', label_name: 'Billing & POS Menu Title', custom_label: 'Billing & POS' },
  { menu_key: 'billing', label_key: 'view_cart', label_name: 'View Cart Label', custom_label: 'View Cart' },
  { menu_key: 'billing', label_key: 'view_cart_details', label_name: 'View Cart Details Title', custom_label: 'View Cart Details' },
  { menu_key: 'billing', label_key: 'add_button', label_name: 'Add Button Label', custom_label: 'Add' },
  { menu_key: 'billing', label_key: 'out_of_stock', label_name: 'Out of Stock Label', custom_label: 'Out of Stock' },
  { menu_key: 'billing', label_key: 'pending_orders', label_name: 'Pending Orders Label', custom_label: 'Pending Orders' },
  { menu_key: 'billing', label_key: 'cart_details_title', label_name: 'Shopping Cart Details Header', custom_label: 'Shopping Cart Details' },
  { menu_key: 'billing', label_key: 'clear_cart_button', label_name: 'Clear Cart Button', custom_label: 'Clear Cart' },
  { menu_key: 'billing', label_key: 'customer_phone_label', label_name: 'Customer Phone Number Label', custom_label: 'Customer Phone Number' },
  { menu_key: 'billing', label_key: 'cart_subtotal_label', label_name: 'Subtotal Label', custom_label: 'Subtotal' },
  { menu_key: 'billing', label_key: 'cart_discount_label', label_name: 'Discount Label', custom_label: 'Discount (₹)' },
  { menu_key: 'billing', label_key: 'cart_total_label', label_name: 'Final Total Label', custom_label: 'Final Total' },
  { menu_key: 'billing', label_key: 'save_pending_button', label_name: 'Save Pending Bill Button', custom_label: 'Save Pending Bill' },
  { menu_key: 'billing', label_key: 'complete_bill_button', label_name: 'Print & Complete Bill Button', custom_label: 'Print & Complete Bill' },

  // Overview Dashboard
  { menu_key: 'overview', label_key: 'overview_menu', label_name: 'Overview Menu Title', custom_label: 'Overview' },
  { menu_key: 'overview', label_key: 'total_revenue', label_name: 'Total Revenue Card Title', custom_label: 'Total Revenue' },
  { menu_key: 'overview', label_key: 'completed_bills', label_name: 'Completed Bills Card Title', custom_label: 'Completed Bills' },
  { menu_key: 'overview', label_key: 'low_stock_alert', label_name: 'Low Stock Alert Card Title', custom_label: 'Low Stock Alert' },
  { menu_key: 'overview', label_key: 'registered_customers', label_name: 'Registered Customers Card Title', custom_label: 'Registered Customers' },

  // Inventory Control View
  { menu_key: 'inventory', label_key: 'inventory_menu', label_name: 'Inventory Menu Title', custom_label: 'Inventory Control' },
  { menu_key: 'inventory', label_key: 'inv_add_item_title', label_name: 'Add Item Header', custom_label: 'Add New Inventory Item' },
  { menu_key: 'inventory', label_key: 'inv_item_name_label', label_name: 'Item Name Input Label', custom_label: 'Item Name' },
  { menu_key: 'inventory', label_key: 'inv_description_label', label_name: 'Description Input Label', custom_label: 'Description' },
  { menu_key: 'inventory', label_key: 'inv_qty_label', label_name: 'Quantity (Stock) Input Label', custom_label: 'Quantity (Stock)' },
  { menu_key: 'inventory', label_key: 'inv_price_label', label_name: 'Price (₹) Input Label', custom_label: 'Price (₹)' },
  { menu_key: 'inventory', label_key: 'inv_image_label', label_name: 'Item Image Input Label', custom_label: 'Item Image' },
  { menu_key: 'inventory', label_key: 'inv_add_button', label_name: 'Add Item Button', custom_label: 'Add Item' },
  { menu_key: 'inventory', label_key: 'inv_items_title', label_name: 'Inventory Items Header', custom_label: 'Inventory Items' },
  { menu_key: 'inventory', label_key: 'inv_th_image', label_name: 'Table Header: Image', custom_label: 'Image' },
  { menu_key: 'inventory', label_key: 'inv_th_name', label_name: 'Table Header: Item Name', custom_label: 'Item Name' },
  { menu_key: 'inventory', label_key: 'inv_th_price', label_name: 'Table Header: Price', custom_label: 'Price' },
  { menu_key: 'inventory', label_key: 'inv_th_stock', label_name: 'Table Header: Stock Qty', custom_label: 'Stock Qty' },
  { menu_key: 'inventory', label_key: 'inv_th_status', label_name: 'Table Header: Status', custom_label: 'Status' },
  { menu_key: 'inventory', label_key: 'inv_th_actions', label_name: 'Table Header: Actions', custom_label: 'Actions' },

  // Customer Directory View
  { menu_key: 'customers', label_key: 'customers_menu', label_name: 'Customers Menu Title', custom_label: 'Customer Directory' },
  { menu_key: 'customers', label_key: 'cust_register_title', label_name: 'Register Customer Header', custom_label: 'Register Customer' },
  { menu_key: 'customers', label_key: 'cust_phone_label', label_name: 'Phone Number Input Label', custom_label: 'Phone Number' },
  { menu_key: 'customers', label_key: 'cust_name_label', label_name: 'Customer Name Input Label', custom_label: 'Customer Name' },
  { menu_key: 'customers', label_key: 'cust_register_button', label_name: 'Register Customer Button', custom_label: 'Register Customer' },
  { menu_key: 'customers', label_key: 'cust_list_title', label_name: 'Customer Directory Header', custom_label: 'Customer Directory' },
  { menu_key: 'customers', label_key: 'cust_th_phone', label_name: 'Table Header: Phone Number', custom_label: 'Phone Number' },
  { menu_key: 'customers', label_key: 'cust_th_name', label_name: 'Table Header: Customer Name', custom_label: 'Customer Name' },
  { menu_key: 'customers', label_key: 'cust_th_date', label_name: 'Table Header: Registered Date', custom_label: 'Registered Date' },

  // User Management View
  { menu_key: 'users', label_key: 'users_menu', label_name: 'Users Menu Title', custom_label: 'User Management' },
  { menu_key: 'users', label_key: 'user_register_title', label_name: 'Register New User Header', custom_label: 'Register New User' },
  { menu_key: 'users', label_key: 'user_roles_title', label_name: 'Custom System Roles Header', custom_label: 'Custom System Roles' },
  { menu_key: 'users', label_key: 'user_username_label', label_name: 'Username Input Label', custom_label: 'Username' },
  { menu_key: 'users', label_key: 'user_password_label', label_name: 'Password Input Label', custom_label: 'Password' },
  { menu_key: 'users', label_key: 'user_role_label', label_name: 'User Role Dropdown Label', custom_label: 'User Role' },
  { menu_key: 'users', label_key: 'user_list_title', label_name: 'System Users Header', custom_label: 'System Users' },
  { menu_key: 'users', label_key: 'user_th_id', label_name: 'Table Header: User ID', custom_label: 'User ID' },
  { menu_key: 'users', label_key: 'user_th_username', label_name: 'Table Header: Username', custom_label: 'Username' },
  { menu_key: 'users', label_key: 'user_th_role', label_name: 'Table Header: System Role', custom_label: 'System Role' },
  { menu_key: 'users', label_key: 'user_th_actions', label_name: 'Table Header: Actions', custom_label: 'Actions' },
  { menu_key: 'users', label_key: 'user_rbac_title', label_name: 'RBAC Card Header', custom_label: 'Role Access Control (Privilege Matrix)' },
  { menu_key: 'users', label_key: 'user_rbac_subtitle', label_name: 'RBAC Card Description', custom_label: 'Configure dynamic view and action (Add, Edit, Delete) authorization privileges for each role' },
  { menu_key: 'users', label_key: 'user_rbac_save_button', label_name: 'Save Privileges Button', custom_label: 'Save Privileges' },
  { menu_key: 'users', label_key: 'user_rbac_th_role', label_name: 'Matrix Table: System Role', custom_label: 'System Role' },
  { menu_key: 'users', label_key: 'user_rbac_th_overview', label_name: 'Matrix Table: Dashboard Overview', custom_label: 'Dashboard Overview' },
  { menu_key: 'users', label_key: 'user_rbac_th_billing', label_name: 'Matrix Table: Billing & POS', custom_label: 'Billing & POS' },
  { menu_key: 'users', label_key: 'user_rbac_th_inventory', label_name: 'Matrix Table: Inventory', custom_label: 'Inventory' },
  { menu_key: 'users', label_key: 'user_rbac_th_customers', label_name: 'Matrix Table: Customers', custom_label: 'Customers' },
  { menu_key: 'users', label_key: 'user_rbac_th_users', label_name: 'Matrix Table: User & Role Management', custom_label: 'User & Role Management' },

  // Custom Label Settings View
  { menu_key: 'custom_labels', label_key: 'custom_labels_menu', label_name: 'Custom Label Menu Title', custom_label: 'Custom Label' },
  { menu_key: 'custom_labels', label_key: 'app_logo', label_name: 'App Logo Image Uploader', custom_label: '' }
];

exports.getAllLabels = async (req, res) => {
  try {
    // 1. Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_labels (
        id SERIAL PRIMARY KEY,
        menu_key VARCHAR(100) NOT NULL,
        label_key VARCHAR(100) UNIQUE NOT NULL,
        label_name VARCHAR(255) NOT NULL,
        custom_label VARCHAR(255) NOT NULL
      );
    `);

    // 2. Check and seed missing default labels dynamically
    for (const item of defaultLabels) {
      await db.query(`
        INSERT INTO custom_labels (menu_key, label_key, label_name, custom_label)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (label_key) DO NOTHING
      `, [item.menu_key, item.label_key, item.label_name, item.custom_label]);
    }

    const { rows } = await db.query('SELECT * FROM custom_labels ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateLabels = async (req, res) => {
  const { labels } = req.body; // Array of { label_key, custom_label }
  try {
    if (!Array.isArray(labels)) {
      return res.status(400).json({ message: 'labels must be an array' });
    }
    
    for (const item of labels) {
      let customLabelVal = item.custom_label;
      if (item.label_key === 'app_logo' && customLabelVal && customLabelVal.startsWith('data:')) {
        const uploadedUrl = await uploadToImgBB(customLabelVal);
        if (!uploadedUrl.startsWith('UPLOAD_ERROR:')) {
          customLabelVal = uploadedUrl;
        } else {
          console.error(uploadedUrl);
        }
      }
      await db.query(
        'UPDATE custom_labels SET custom_label = $1 WHERE label_key = $2',
        [customLabelVal, item.label_key]
      );
    }
    
    const { rows } = await db.query('SELECT * FROM custom_labels ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
