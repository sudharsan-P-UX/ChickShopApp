const db = require('../config/db');

exports.getAllItems = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM inventory ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addItem = async (req, res) => {
  const { item_name, description, qty, price } = req.body;
  const image_url = req.file ? 'https://picsum.photos/200' : null;
  try {
    const { rows } = await db.query(
      'INSERT INTO inventory (item_name, description, qty, price, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [item_name, description, qty, price, image_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { item_name, description, qty, price } = req.body;
  const image_url = req.file ? 'https://picsum.photos/200' : req.body.image_url;
  try {
    const { rows } = await db.query(
      'UPDATE inventory SET item_name = $1, description = $2, qty = $3, price = $4, image_url = $5 WHERE id = $6 RETURNING *',
      [item_name, description, qty, price, image_url, id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM inventory WHERE id = $1', [id]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
