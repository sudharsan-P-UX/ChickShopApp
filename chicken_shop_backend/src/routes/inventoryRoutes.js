const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const upload = require('../middlewares/uploadMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

router.get('/', authMiddleware, authorize('inventory', 'view'), inventoryController.getAllItems);
router.post('/', authMiddleware, authorize('inventory', 'add'), upload.single('image'), inventoryController.addItem);
router.put('/:id', authMiddleware, authorize('inventory', 'edit'), upload.single('image'), inventoryController.updateItem);
router.delete('/:id', authMiddleware, authorize('inventory', 'delete'), inventoryController.deleteItem);

module.exports = router;
