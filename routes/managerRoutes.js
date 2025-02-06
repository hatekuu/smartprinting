const express = require('express');
const { verifyRole } = require('../middlewares/roleMiddleware');
const { 
    getAllUsers,
    getOrders,updateOrderStatus ,getRevenueReport,getTopSellingProducts,getPromotionEffectiveness,
    updateProduct,addProduct
    } = require('../controllers/managerController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Route chỉ cho phép 'manager' truy cập
router.get('/users',authMiddleware, verifyRole('manager'), getAllUsers);
router.get('/orders',authMiddleware, verifyRole('manager'), getOrders);
router.put('/orders/update',authMiddleware, verifyRole('manager'), updateOrderStatus);
router.get('/revenue',authMiddleware, verifyRole('manager'), getRevenueReport);
router.get('/top-selling-products',authMiddleware, verifyRole('manager'), getTopSellingProducts);
router.get('/promotion-effectiveness',authMiddleware, verifyRole('manager'), getPromotionEffectiveness);
router.put('/update', authMiddleware, verifyRole('manager'), updateProduct);
router.post('/', authMiddleware, verifyRole('manager'), addProduct);
module.exports = router;
