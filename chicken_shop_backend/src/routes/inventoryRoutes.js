const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const upload = require('../middlewares/uploadMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access Denied: Insufficient Privileges' });
    }
    next();
  };
};

router.get('/', authMiddleware, inventoryController.getAllItems);
router.post('/', authMiddleware, allowRoles('admin', 'manager'), upload.single('image'), inventoryController.addItem);
router.put('/:id', authMiddleware, allowRoles('admin', 'manager'), upload.single('image'), inventoryController.updateItem);
router.delete('/:id', authMiddleware, allowRoles('admin', 'manager'), inventoryController.deleteItem);

module.exports = router;
