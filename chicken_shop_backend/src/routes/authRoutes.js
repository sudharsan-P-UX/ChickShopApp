const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const adminOnly = (req, res, next) => {
  const role = req.user ? req.user.role : null;
  if (!role || (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin')) {
    return res.status(403).json({ message: 'Access Denied: Admin Privilege Required' });
  }
  next();
};

router.post('/login', authController.login);
router.post('/register', authMiddleware, adminOnly, authController.register);
router.get('/users', authMiddleware, adminOnly, authController.listUsers);
router.put('/users/:id/role', authMiddleware, adminOnly, authController.updateRole);
router.put('/users/:id', authMiddleware, adminOnly, authController.updateUser);
router.delete('/users/:id', authMiddleware, adminOnly, authController.deleteUser);

// Roles routing
router.get('/roles', authMiddleware, authController.listRoles);
router.post('/roles', authMiddleware, adminOnly, authController.createRole);
router.delete('/roles/:id', authMiddleware, adminOnly, authController.deleteRole);
router.put('/roles/:id/permissions', authMiddleware, adminOnly, authController.updateRolePermissions);

module.exports = router;
