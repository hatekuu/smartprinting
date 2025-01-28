const express = require('express');
const { getCommandAndUpdateStatus,uploadGcodeFile,sendCommand,addPrinter} = require( '../controllers/3dprintController');
const router = express.Router();

router.post('/getCommand', getCommandAndUpdateStatus);
router.post('/uploadFile', uploadGcodeFile);
router.post('/sendCommand', sendCommand);
router.post('/addPrinter', addPrinter);
module.exports = router;
