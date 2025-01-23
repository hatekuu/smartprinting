const { getDB } = require('../config/db');

// Lấy danh sách tất cả người dùng (chỉ dành cho 'manager')
const getAllUsers = async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('users');

    const users = await collection.find({}, { projection: { password: 0, secretKey: 0 } }).toArray();
    res.status(200).json(users);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ!' });
  }
};

module.exports = { getAllUsers };
