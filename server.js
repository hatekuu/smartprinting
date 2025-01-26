const express = require('express');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const managerRoutes = require('./routes/managerRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const printRoutes = require('./routes/3dprintRoutes');
const cron = require('node-cron');
const { cleanupExpiredTokens } = require('./services/blacklistService');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());

// // CORS configuration
// const corsOptions = {
//   origin: process.env.URL, // Allow requests only from the origin defined in .env
//   methods: ['GET', 'POST', 'PUT', 'DELETE'], // Optional, specify allowed methods
//   credentials: true, // Optional, allow cookies to be sent
// };

app.use(cors());

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
app.use('/api/3dprint', printRoutes);
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
