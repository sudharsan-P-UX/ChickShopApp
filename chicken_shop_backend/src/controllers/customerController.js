const db = require('../config/db');

exports.getCustomer = async (req, res) => {
  const { phone } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM customers WHERE phone_no = $1', [phone]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addCustomer = async (req, res) => {
  const { phone_no, name } = req.body;
  try {
    const { rows } = await db.query(
      'INSERT INTO customers (phone_no, name) VALUES ($1, $2) RETURNING *',
      [phone_no, name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
