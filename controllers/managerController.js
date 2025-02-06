const { getDB } = require('../config/db');
const { get } = require('../routes/productRoutes');

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
const updateProduct = async (req, res) => {
  try {

    const { name, price, description, stock,id } = req.body;

    const db = getDB();
    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, price, description, stock } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật' });
    }

    res.json({ message: 'Cập nhật sản phẩm thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi cập nhật thông tin sản phẩm' });
  }
};
const addProduct = async (req, res) => {
  try {
    const { name, price, description, stock } = req.body;

    const db = getDB();
    const result = await db.collection('products').insertOne({
      name,
      price,
      description,
      stock,
      createdAt: new Date(),
    });

    res.status(201).json({ message: 'Thêm sản phẩm thành công', productId: result.insertedId });
  } catch (error) {
    console.error('Lỗi thêm sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi thêm sản phẩm' });
  }
};
// 1️⃣ Lấy danh sách đơn hàng của user
const getOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }
    const db = getDB();
    const orders = await db.collection('orders').find({ userId: new ObjectId(userId) }).toArray();
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách đơn hàng', error });
  }
};

// 2️⃣ Cập nhật trạng thái đơn hàng
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    if (!ObjectId.isValid(orderId) || !['chờ xử lý', 'đang giao', 'hoàn thành'].includes(status)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }
    const db = getDB();
    await db.collection('orders').updateOne({ _id: new ObjectId(orderId) }, { $set: { status } });
    return res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi cập nhật trạng thái đơn hàng', error });
  }
};

const getRevenueReport = async (req, res) => {
  try {
    const { timeFrame } = req.query; // daily, monthly, yearly
    const db = getDB();
    
    let matchStage = {};
    if (timeFrame === 'daily') {
      matchStage = { createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } };
    } else if (timeFrame === 'monthly') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      matchStage = { createdAt: { $gte: startOfMonth } };
    } else if (timeFrame === 'yearly') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      matchStage = { createdAt: { $gte: startOfYear } };
    }
    
    const revenue = await db.collection('orders').aggregate([
      { $match: matchStage },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]).toArray();
    
    res.json({ totalRevenue: revenue[0]?.totalRevenue || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy báo cáo doanh thu', error });
  }
};

const getTopSellingProducts = async (req, res) => {
  try {
    const db = getDB();
    
    const topProducts = await db.collection('orders').aggregate([
      { $unwind: '$products' },
      { $group: { _id: '$products.productId', totalSold: { $sum: '$products.quantity' } } },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách sản phẩm bán chạy', error });
  }
};

const getPromotionEffectiveness = async (req, res) => {
  try {
    const db = getDB();
    
    const promotions = await db.collection('orders').aggregate([
      { $match: { discountCode: { $exists: true, $ne: null } } },
      { $group: { _id: '$discountCode', totalUsage: { $sum: 1 }, totalDiscount: { $sum: '$discountAmount' } } },
      { $sort: { totalUsage: -1 } }
    ]).toArray();
    
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy hiệu quả quảng cáo/khuyến mãi', error });
  }
};

module.exports = { getAllUsers ,getOrders,updateOrderStatus,getRevenueReport,getTopSellingProducts,getPromotionEffectiveness,updateProduct,addProduct};
