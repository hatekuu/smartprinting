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
      address: user.address || [],
      number: user.number || '',
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { userId, addressIndex, address, phone, note, number } = req.body;
    const db = getDB();
    const updateFields = {};

    if (number) updateFields.number = number;
    
    if (addressIndex !== undefined) {
      const addressPath = `address.${addressIndex}`;
      updateFields[addressPath] = { 
        address, 
        phone: phone || '', 
        note: note || '' 
      };
      
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "Không có dữ liệu để cập nhật" });
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );
    
    return res.status(200).json({ message: "Cập nhật thành công" });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
const deleteAddress = async (req, res) => {
  try {
    const { userId, addressIndex } = req.body;

    if (!userId || addressIndex === undefined) {
      return res.status(400).json({ message: "Thiếu userId hoặc addressIndex" });
    }

    const db = getDB();
    const objectId = new ObjectId(userId);

    // Bước 1: Xóa địa chỉ bằng $unset
    const unsetResult = await db.collection('users').updateOne(
      { _id: objectId },
      { $unset: { [`address.${addressIndex}`]: "" } }
    );

    if (unsetResult.modifiedCount === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng hoặc địa chỉ" });
    }

    // Bước 2: Dùng $pull để xóa giá trị null
    await db.collection('users').updateOne(
      { _id: objectId },
      { $pull: { address: null } }
    );

    return res.status(200).json({ message: "Đã xóa địa chỉ thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa địa chỉ:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};


module.exports = { getUserProfile, updateProfile, deleteAddress };
