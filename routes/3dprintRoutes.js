const express = require('express');
const { uploadFile ,getCommandAndUpdateStatus,uploadGcodeFile,sendCommand,getPrinter,updateStatus,uploadStlChunk,confirmOrder,processGcodePricing,downloadStl,confirmDonwload} = require( '../controllers/3dprintController');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.post('/getCommand', getCommandAndUpdateStatus);
router.post('/uploadFile', uploadGcodeFile);
router.post('/sendCommand', sendCommand);
router.post('/updateStatus', updateStatus);
router.post('/getPrinter',authMiddleware,getPrinter)
router.post('/uploadStl',authMiddleware,uploadStlChunk)
router.post('/confirm-order', confirmOrder);
router.post('/gcodepricing', processGcodePricing);
router.post('/download-stl', downloadStl);
router.post('/confirm-download', confirmDonwload);
router.post('/upload', upload.single('file'), uploadFile);
module.exports = router;
