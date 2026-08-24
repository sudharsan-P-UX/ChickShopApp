const db = require('../config/db');

exports.getMenus = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM menu_order ORDER BY main_menu, display_order');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMenuOrders = async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ message: 'Invalid updates payload' });
  }

  try {
    await db.query('BEGIN');
    for (const item of updates) {
      await db.query(
        'UPDATE menu_order SET display_order = $1, is_active = $2 WHERE submenu_key = $3',
        [item.display_order, item.is_active, item.submenu_key]
      );
    }
    await db.query('COMMIT');
    res.json({ message: 'Menu order updated successfully' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
};
