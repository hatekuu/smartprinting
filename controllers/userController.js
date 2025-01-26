const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // Assuming user ID is stored in req.user.userId after authentication
    const db = getDB();
    const collection = db.collection('users');

    // Convert userId to ObjectId
    const objectId = new ObjectId(userId);

    // Lấy thông tin người dùng từ database
    const user = await collection.findOne({ _id: objectId });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    // Trả về thông tin người dùng
    res.status(200).json({ 
      username: user.username,
      userId: user._id,
      role: user.role,
      // Add other user fields as needed
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = { getUserProfile };