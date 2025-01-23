const express = require('express');
const { login, register, forgotPassword, logout } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/logout',authMiddleware, logout);

module.exports = router;
