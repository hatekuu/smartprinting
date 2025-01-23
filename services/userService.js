const bcrypt = require('bcrypt');
const { getDB } = require('../config/db');

const findUserByUsername = async (username) => {
  const db = getDB();
  return await db.collection('users').findOne({ username });
};

const createUser = async (userData) => {
  const db = getDB();
  const { username, password, secretKey } = userData;

  const hashedPassword = await bcrypt.hash(password, 10);
  const hashedSecretKey = await bcrypt.hash(secretKey, 10);

  const newUser = {
    username,
    password: hashedPassword,
    secretKey: hashedSecretKey,
    createdAt: new Date(),
  };

  return await db.collection('users').insertOne(newUser);
};

const updateUserPassword = async (username, newPassword) => {
  const db = getDB();
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  return await db.collection('users').updateOne(
    { username },
    { $set: { password: hashedPassword } }
  );
};

module.exports = { findUserByUsername, createUser, updateUserPassword };
