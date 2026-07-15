const db = require('../config/db');

exports.savePendingBill = async (req, res) => {
  const { id, items, subtotal } = req.body;
  try {
    if (id) {
      const { rows } = await db.query(
        'UPDATE pending_bills SET items = $1, subtotal = $2 WHERE id = $3 RETURNING *',
        [JSON.stringify(items), subtotal, id]
      );
      res.status(200).json(rows[0]);
    } else {
      const { rows } = await db.query(
        'INSERT INTO pending_bills (items, subtotal) VALUES ($1, $2) RETURNING *',
        [JSON.stringify(items), subtotal]
      );
      res.status(201).json(rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPendingBills = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM pending_bills ORDER BY saved_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePendingBill = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM pending_bills WHERE id = $1', [id]);
    res.json({ message: 'Pending bill deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.completeBill = async (req, res) => {
  const { customer_phone, items, total_amount, discount, final_price, pending_bill_id } = req.body;
  try {
    await db.query('BEGIN'); // Start transaction

    // 1. Insert completed bill
    const { rows } = await db.query(
      'INSERT INTO completed_bills (customer_phone, items, total_amount, discount, final_price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [customer_phone, JSON.stringify(items), total_amount, discount || 0, final_price]
    );

    // 2. Reduce inventory qty
    for (const item of items) {
      await db.query('UPDATE inventory SET qty = qty - $1 WHERE id = $2', [item.qty, item.id]);
    }

    // 3. Delete from pending if applicable
    if (pending_bill_id) {
      await db.query('DELETE FROM pending_bills WHERE id = $1', [pending_bill_id]);
    }

    await db.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
};

exports.getCompletedBills = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM completed_bills ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
