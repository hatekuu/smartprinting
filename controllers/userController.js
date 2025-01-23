const getUserProfile = async (req, res) => {
    try {
      // Logic lấy thông tin user từ database
      res.status(200).json({ message: 'Thông tin người dùng' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Lỗi server' });
    }
  };
  
  module.exports = { getUserProfile };
  