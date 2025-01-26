const express = require('express');
const { getCommandAndUpdateStatus,uploadGocdeFile,sendCommand,addPrinter} = require( '../controllers/3dprintController');
const router = express.Router();

router.post('/getCommand', getCommandAndUpdateStatus);
router.post('/uploadFile', uploadGocdeFile);
router.post('/sendCommand', sendCommand);
router.post('/addPrinter', addPrinter);
module.exports = router;
