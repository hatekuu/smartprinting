const express = require('express');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const managerRoutes = require('./routes/managerRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const cron = require('node-cron');
const { cleanupExpiredTokens } = require('./services/blacklistService');
require('dotenv').config();

const app = express();
app.use(express.json());

// Kết nối MongoDB
connectDB();
// API routes
app.get('/', (req, res) => {
  res.send('Server Node.js đang chạy!');
});
// Cron job dọn dẹp token hết hạn mỗi ngày
cron.schedule('0 0 * * *', () => {
  cleanupExpiredTokens();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/product', productRoutes);
app.use('/api/user', userRoutes);

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Có lỗi xảy ra!' });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
