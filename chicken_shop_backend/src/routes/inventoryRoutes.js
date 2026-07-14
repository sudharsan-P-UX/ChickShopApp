const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const upload = require('../middlewares/uploadMiddleware');

router.get('/', inventoryController.getAllItems);
router.post('/', upload.single('image'), inventoryController.addItem);
router.put('/:id', upload.single('image'), inventoryController.updateItem);
router.delete('/:id', inventoryController.deleteItem);

module.exports = router;
