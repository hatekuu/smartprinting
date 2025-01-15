const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI);

let db;

// Kết nối tới MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db("dong"); // Lấy database
    console.log('Kết nối MongoDB thành công!');
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error);
    process.exit(1); // Thoát nếu không kết nối được
  }
}

// Lấy instance của database
function getDB() {
  if (!db) {
    throw new Error('Database chưa được khởi tạo!');
  }
  return db;
}

module.exports = { connectDB, getDB };
