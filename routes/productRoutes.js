const express = require('express');
const { 
    getProducts,getProductById,findProduct,suggestKeyword,reviewProduct,
    addToCart,removeFromCart,updateCart,getCart,
    applyDiscount,checkout,requestReturn,cancelOrder
} = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();
router.get('/',authMiddleware, getProducts);
router.get('/id', authMiddleware, getProductById);
router.post('/search', authMiddleware,findProduct);
router.get('/suggest-keyword',authMiddleware, suggestKeyword);
router.post('/cart/add', addToCart);
router.post('/cart/remove', removeFromCart);
router.put('/cart/update', updateCart);
router.post('/cart/discount', applyDiscount);
router.post('/cart/checkout', checkout);
router.post('/cart', getCart);
router.post('/review', authMiddleware, reviewProduct);
router.post('/return', authMiddleware, requestReturn);
router.post('/cancel', authMiddleware, cancelOrder);
module.exports = router;
