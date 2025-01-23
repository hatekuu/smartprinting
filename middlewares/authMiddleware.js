const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../services/blacklistService');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Bạn cần đăng nhập để truy cập!' });
    }

    // Kiểm tra token có bị blacklist không
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token đã bị thu hồi, vui lòng đăng nhập lại!' });
    }

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin user vào request
    next(); // Cho phép tiếp tục
  } catch (error) {
    console.error('Lỗi xác thực token:', error.message);
    return res.status(403).json({ message: 'Token không hợp lệ!' });
  }
};

module.exports = authMiddleware;
