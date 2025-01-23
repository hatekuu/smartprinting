const express = require('express');
const { verifyRole } = require('../middlewares/roleMiddleware');
const { getAllUsers } = require('../controllers/managerController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Route chỉ cho phép 'manager' truy cập
router.get('/users',authMiddleware, verifyRole('manager'), getAllUsers);

module.exports = router;
