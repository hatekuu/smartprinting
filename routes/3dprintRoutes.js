const express = require('express');
const { filterPrint,postData,getFilePrint ,uploadFile, getCommandAndUpdateStatus, uploadGcodeFile, sendCommand, getPrinter, updateStatus, confirmOrder, processGcodePricing, downloadStl, confirmDownload } = require('../controllers/3dprintController');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require("multer");
const router = express.Router();

const fs = require("fs");
const tmpDir = "/tmp";
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: "/tmp", // Lưu file vào thư mục /tmp/
    filename: (req, file, cb) => {
      cb(null, file.originalname); // Giữ nguyên tên file gốc
    }
  });
  
  const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/postData',postData );
router.post('/getCommand', getCommandAndUpdateStatus);
router.post('/getFile', getFilePrint);
router.post('/uploadFile', uploadGcodeFile);
router.post('/sendCommand', sendCommand);
router.post('/updateStatus', updateStatus);
router.post('/getPrinter', authMiddleware, getPrinter);

router.post('/filterPrint', filterPrint);
router.post('/confirm-order', confirmOrder);
router.post('/gcodepricing', processGcodePricing);
router.post('/download-stl', downloadStl);
router.post('/confirm-download', confirmDownload);
router.post("/upload", upload.single("file"), uploadFile);

module.exports = router;
