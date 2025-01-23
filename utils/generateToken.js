const jwt = require('jsonwebtoken');

const generateToken = (userId, username) => {
  return jwt.sign({ userId, username }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

module.exports = generateToken;
