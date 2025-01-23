const jwt = require('jsonwebtoken');

const verifyRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'Bạn cần đăng nhập để truy cập!' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Kiểm tra vai trò
      if (decoded.role !== requiredRole) {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập!' });
      }

      req.user = decoded; // Lưu thông tin user vào request
      next(); // Tiếp tục
    } catch (error) {
      console.error('Lỗi xác thực vai trò:', error.message);
      return res.status(403).json({ message: 'Token không hợp lệ!' });
    }
  };
};

module.exports = { verifyRole };
