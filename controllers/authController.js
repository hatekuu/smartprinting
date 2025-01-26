const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');
const { addToBlacklist } = require('../services/blacklistService');

// Đăng ký người dùng mới
const register = async (req, res) => {
  try {
    const { username, password, confirmPassword, secretKey, role = 'user' } = req.body;

    if (!username || !password || !confirmPassword || !secretKey) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin!' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu không khớp!' });
    }

    const db = getDB();
    const collection = db.collection('users');

    // Kiểm tra người dùng đã tồn tại chưa
    const existingUser = await collection.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Tên người dùng đã tồn tại!' });
    }

    // Hash mật khẩu và secretKey
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedSecretKey = await bcrypt.hash(secretKey, 10);

    // Thêm người dùng vào database
    await collection.insertOne({
      username,
      password: hashedPassword,
      secretKey: hashedSecretKey,
      role: role === 'manager' ? 'manager' : 'user', // Giới hạn vai trò
    });

    res.status(201).json({ message: 'Đăng ký thành công!' });
  } catch (error) {
    console.error('Lỗi khi đăng ký:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ!' });
  }
};

// Quên mật khẩu
const forgotPassword = async (req, res) => {
  const { username, secretKey, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
  }

  try {
    const db = getDB();
    const user = await db.collection('users').findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    // Xác thực secret key
    const isSecretKeyValid = await bcrypt.compare(secretKey, user.secretKey);
    if (!isSecretKeyValid) {
      return res.status(400).json({ message: 'Secret key không đúng' });
    }

    // Cập nhật mật khẩu
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne(
      { username },
      { $set: { password: hashedNewPassword } }
    );

    res.status(200).json({ message: 'Đặt lại mật khẩu thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi đặt lại mật khẩu', error: error.message });
  }
};
// Đăng nhập người dùng
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập tên người dùng và mật khẩu!' });
    }

    const db = getDB();
    const collection = db.collection('users');

    // Tìm người dùng
    const user = await collection.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng!' });
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng!' });
    }

    // Tạo token với vai trò
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Trả về token, vai trò và ID của người dùng
    res.status(200).json({ token, role: user.role, userId: user._id });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi đăng nhập', error: error.message });
  }
};
// Đăng xuất người dùng
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(400).json({ message: 'Token không được cung cấp!' });
    }

    // Decode token để lấy thời gian hết hạn
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return res.status(400).json({ message: 'Token không hợp lệ!' });
    }

    // Thêm token vào blacklist với thời gian hết hạn
    const expiresAt = new Date(decoded.exp * 1000); // Chuyển từ Unix timestamp sang Date
    await addToBlacklist(token, expiresAt);

    return res.status(200).json({ message: 'Đăng xuất thành công!' });
  } catch (error) {
    console.error('Lỗi khi đăng xuất:', error.message);
    return res.status(500).json({ message: 'Lỗi khi đăng xuất' });
  }
};
  
  module.exports = { login, register, forgotPassword, logout };
