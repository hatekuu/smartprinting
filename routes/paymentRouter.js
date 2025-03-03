const express = require('express');
const { payment,paymentCallback } =require("../controllers/paymentController");
const router = express.Router();
router.post('/payment',payment)
router.post('/paymentCallback',paymentCallback)
module.exports = router;