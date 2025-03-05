const express = require('express');
const { payment,paymentCallback,transactionStatus } =require("../controllers/paymentController");
const router = express.Router();
router.post('/payment',payment)
router.post('/paymentCallback',paymentCallback)
router.post('/transactionStatus',transactionStatus)
module.exports = router;