const express = require('express');
const { getCommandAndUpdateStatus } = require( '../controllers/3dprintController');
const router = express.Router();

router.post('/command', getCommandAndUpdateStatus);


module.exports = router;
