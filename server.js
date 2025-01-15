require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectDB, getDB } = require('./database/db');

// Khởi tạo app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Kết nối tới MongoDB
connectDB();

// API routes
app.get('/', (req, res) => {
  res.send('Server Node.js đang chạy!');
});

app.post('/example', async (req, res) => {
    try {
      const db = getDB();
      const collection = db.collection('examples');
      const result = await collection.insertOne(req.body);
  
      // Trả về ID của tài liệu vừa chèn
      res.status(201).json({
        message: 'Dữ liệu đã được lưu thành công',
        insertedId: result.insertedId,
      });
    } catch (error) {
      res.status(400).json({ message: 'Lỗi khi lưu dữ liệu', error: error.message });
    }
  });
  

app.get('/example', async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('examples');
    const examples = await collection.find().toArray();
    res.json(examples);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu', error });
  }
});

// Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
module.exports = app