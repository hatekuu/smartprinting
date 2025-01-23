const express = require('express');
const { getUserProfile } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const {verifyRole}= require('../middlewares/roleMiddleware')
const router = express.Router();

// Route yêu cầu xác thực
router.get('/profile', authMiddleware,verifyRole('user','manager') ,getUserProfile);

module.exports = router;
