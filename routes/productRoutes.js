const express = require('express');
const { 
    getProducts,getProductById,findProduct,suggestKeyword,reviewProduct,
    addToCart,removeFromCart,updateCart,getCart,
    getDiscount,applyDiscount,checkout,requestReturn,cancelOrder
} = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();
router.get('/',authMiddleware, getProducts);
router.get('/id', authMiddleware, getProductById);
router.post('/search', authMiddleware,findProduct);
router.get('/suggest-keyword',authMiddleware, suggestKeyword);
router.post('/cart/add',authMiddleware, addToCart);
router.post('/cart/remove',authMiddleware, removeFromCart);
router.put('/cart/update',authMiddleware, updateCart);
router.post('/cart/discount',applyDiscount);
router.get('/cart/getdiscount', authMiddleware, getDiscount);
router.post('/cart/checkout', authMiddleware,checkout);
router.post('/cart',authMiddleware, getCart);
router.post('/review', authMiddleware, reviewProduct);
router.post('/return', authMiddleware, requestReturn);
router.post('/cancel', authMiddleware, cancelOrder);
module.exports = router;
