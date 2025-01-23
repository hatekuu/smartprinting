const express = require('express');
const { getProducts,getProductById,updateProduct, addProduct } = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');
const {verifyRole}= require('../middlewares/roleMiddleware')
const router = express.Router();

router.get('/',authMiddleware, getProducts);
router.get('/:id', authMiddleware, getProductById);
router.put('/:id', authMiddleware, verifyRole('manager'), updateProduct);
router.post('/', authMiddleware, verifyRole('manager'), addProduct);

module.exports = router;
