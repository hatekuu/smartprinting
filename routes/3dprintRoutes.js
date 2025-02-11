const express = require('express');
const { uploadFile, getCommandAndUpdateStatus, uploadGcodeFile, sendCommand, getPrinter, updateStatus, confirmOrder, processGcodePricing, downloadStl, confirmDownload } = require('../controllers/3dprintController');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require("multer");
const router = express.Router();


router.post('/getCommand', getCommandAndUpdateStatus);
router.post('/uploadFile', uploadGcodeFile);
router.post('/sendCommand', sendCommand);
router.post('/updateStatus', updateStatus);
router.post('/getPrinter', authMiddleware, getPrinter);

router.post('/confirm-order', confirmOrder);
router.post('/gcodepricing', processGcodePricing);
router.post('/download-stl', downloadStl);
router.post('/confirm-download', confirmDownload);
const upload = multer({ dest: "/tmp/" });

// Endpoint upload file
router.post('/uploadFile', upload.single('file'), uploadFile);

module.exports = router;
