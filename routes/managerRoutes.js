const express = require('express');
const { verifyRole } = require('../middlewares/roleMiddleware');
const { 
    getAllUsers,
    getAllOrders,updateOrderStatus ,getRevenueReport,getTopSellingProducts,getPromotionEffectiveness,
    updateProduct,addProduct,deleteProduct,
  addPrinter,updatePrinter,deletePrinter,getPrinter,calculateRevenueByTime
    } = require('../controllers/managerController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Route chỉ cho phép 'manager' truy cập
router.get('/users',authMiddleware, verifyRole('manager'), getAllUsers);
router.get('/revenue',authMiddleware, verifyRole('manager'), getRevenueReport);
router.get('/top-selling-products',authMiddleware, verifyRole('manager'), getTopSellingProducts);
router.get('/promotion-effectiveness',authMiddleware, verifyRole('manager'), getPromotionEffectiveness);
router.put('/product',authMiddleware, verifyRole('manager'), updateProduct);
router.post('/',authMiddleware, verifyRole('manager'), addProduct);
router.post('/deleteProduct', authMiddleware, verifyRole('manager'), deleteProduct);
router.post('/addPrinter',authMiddleware, verifyRole('manager'), addPrinter);
router.post('/deletePrinter',authMiddleware, verifyRole('manager'), deletePrinter);
router.post('/updatePrinter',authMiddleware, verifyRole('manager'), updatePrinter);
router.post('/getPrinter',authMiddleware, verifyRole('manager'), getPrinter);
router.post('/allorder',getAllOrders)
router.put('/orders/update', updateOrderStatus);
router.post('/orders/profit', calculateRevenueByTime);
module.exports = router;
