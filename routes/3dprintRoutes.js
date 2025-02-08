const express = require('express');
const { getCommandAndUpdateStatus,uploadGcodeFile,sendCommand,getPrinter,updateStatus,uploadStlChunk} = require( '../controllers/3dprintController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/getCommand', getCommandAndUpdateStatus);
router.post('/uploadFile', uploadGcodeFile);
router.post('/sendCommand', sendCommand);
router.post('/updateStatus', updateStatus);
router.post('/getPrinter',authMiddleware,getPrinter)
router.post('/uploadStl',authMiddleware,uploadStlChunk)
module.exports = router;
