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
