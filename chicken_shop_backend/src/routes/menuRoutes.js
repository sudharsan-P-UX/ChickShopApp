const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

router.get('/', authMiddleware, authorize('menu_order', 'view'), menuController.getMenus);
router.post('/order', authMiddleware, authorize('menu_order', 'edit'), menuController.updateMenuOrders);

module.exports = router;
