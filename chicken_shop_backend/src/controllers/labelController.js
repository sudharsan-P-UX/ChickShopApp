const db = require('../config/db');

exports.getAllLabels = async (req, res) => {
  try {
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
      await db.query(
        'UPDATE custom_labels SET custom_label = $1 WHERE label_key = $2',
        [item.custom_label, item.label_key]
      );
    }
    
    const { rows } = await db.query('SELECT * FROM custom_labels ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
