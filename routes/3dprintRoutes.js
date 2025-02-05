const express = require('express');
const { getCommandAndUpdateStatus,uploadGcodeFile,sendCommand,addPrinter,updateStatus} = require( '../controllers/3dprintController');
const router = express.Router();

router.post('/getCommand', getCommandAndUpdateStatus);
router.post('/uploadFile', uploadGcodeFile);
router.post('/sendCommand', sendCommand);
router.post('/addPrinter', addPrinter);
router.post('/updateStatus', updateStatus);
module.exports = router;
