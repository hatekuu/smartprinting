const { getDB } = require('../config/db');

// Thêm token vào blacklist
const addToBlacklist = async (token, expiresAt) => {
  try {
    const db = getDB();
    const collection = db.collection('blacklisted_tokens');

    // Thêm token và thời gian hết hạn vào collection
    await collection.insertOne({
      token,
      expiresAt,
    });
    console.log(`Token đã được thêm vào blacklist: ${token}`);
  } catch (error) {
    console.error('Lỗi khi thêm token vào blacklist:', error.message);
  }
};

// Kiểm tra token có trong blacklist hay không
const isTokenBlacklisted = async (token) => {
  try {
    const db = getDB();
    const collection = db.collection('blacklisted_tokens');

    // Kiểm tra token trong collection
    const result = await collection.findOne({ token });

    // Trả về true nếu token tồn tại, false nếu không
    return !!result;
  } catch (error) {
    console.error('Lỗi khi kiểm tra token trong blacklist:', error.message);
    return false; // Nếu lỗi, coi như token không bị blacklist
  }
};
const cleanupExpiredTokens = async () => {
    try {
      const db = getDB();
      const collection = db.collection('blacklisted_tokens');
  
      // Xóa token đã hết hạn
      const result = await collection.deleteMany({ expiresAt: { $lt: new Date() } });
      console.log(`Đã xóa ${result.deletedCount} token hết hạn.`);
    } catch (error) {
      console.error('Lỗi khi xóa token hết hạn:', error.message);
    }
  };
  
  module.exports = { addToBlacklist, isTokenBlacklisted, cleanupExpiredTokens };

