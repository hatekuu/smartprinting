const { MongoClient } = require('mongodb');

let db;

const connectDB = async () => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db(process.env.DB_NAME);
    console.log('Kết nối MongoDB thành công!');
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error.message);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database chưa được kết nối!');
  }
  return db;
};

module.exports = { connectDB, getDB };
