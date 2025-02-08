const express = require('express');
const { getUserProfile,updateProfile,deleteAddress } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const {verifyRole}= require('../middlewares/roleMiddleware')
const router = express.Router();

// Route yêu cầu xác thực
router.get('/profile', authMiddleware,verifyRole('user','manager') ,getUserProfile);
router.post('/profile' ,authMiddleware,verifyRole('user','manager'),updateProfile);
router.post('/profile/delete' ,authMiddleware,verifyRole('user','manager'),deleteAddress);
module.exports = router;
