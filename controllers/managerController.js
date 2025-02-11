const { ObjectId } = require('mongodb');
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
const addProduct = async (req, res) => {
  try {
    const { name, price, description, stock,category } = req.body;

    if (!name || !price || !description ) {
      return res.status(400).json({ message: 'Thiếu thông tin sản phẩm' });
    }

    const db = getDB();
    const result = await db.collection('products').insertOne({
      name,
      price,
      description,
      category,
      stock,
      createdAt: new Date(),
    });

    res.status(201).json({ message: 'Thêm sản phẩm thành công', productId: result.insertedId });
  } catch (error) {
    console.error('Lỗi thêm sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi thêm sản phẩm', error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { _id, name, price, description, stock,category } = req.body;

    if (!_id || !ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (name) updateData.category = category;
    if (price) updateData.price = Number(price);
    if (description) updateData.description = description;
    if (stock !== undefined) updateData.stock = Number(stock);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Không có dữ liệu cập nhật' });
    }

    const db = getDB();
    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(_id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật' });
    }

    res.json({ message: 'Cập nhật sản phẩm thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi cập nhật thông tin sản phẩm', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const db = getDB();
    const result = await db.collection('products').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa' });
    }

    res.status(200).json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi khi xóa sản phẩm', error: error.message });
  }
};
//  Lấy danh sách đơn hàng của users
const getAllOrders = async (req, res) => {
  try {
    const db = getDB();

    // Định nghĩa thứ tự ưu tiên cho trạng thái
    const statusPriority = {
      pending: 1,   // Chờ xử lý (quan trọng nhất)
      processing: 2, // Đang xử lý
      shipped: 3,   // Đang giao
      completed: 4, // Đã hoàn thành
      cancelled: 5  // Bị hủy (hiển thị sau cùng)
    };

    // Truy vấn tất cả đơn hàng, sắp xếp theo trạng thái + thời gian
    const orders = await db.collection("orders")
      .aggregate([
        {
          $addFields: {
            statusPriority: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "pending"] }, then: 1 },
                  { case: { $eq: ["$status", "processing"] }, then: 2 },
                  { case: { $eq: ["$status", "shipped"] }, then: 3 },
                  { case: { $eq: ["$status", "completed"] }, then: 4 },
                  { case: { $eq: ["$status", "cancelled"] }, then: 5 },
                ],
                default: 99 // Nếu trạng thái không hợp lệ
              }
            }
          }
        },
        { $sort: { statusPriority: 1, createdAt: -1 } }, // Sắp xếp theo trạng thái, sau đó thời gian mới nhất
        { $project: { statusPriority: 0 } } // Ẩn trường tạm statusPriority
      ])
      .toArray();

    if (orders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào" });
    }

    return res.json( orders );
  } catch (error) {
    return res.status(500).json({ message: "Lỗi lấy danh sách đơn hàng", error });
  }
};


//  Cập nhật trạng thái đơn hàng
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    const db = getDB();

    const validStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const order = await db.collection("orders").findOne({ _id: new ObjectId(orderId) });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Kiểm tra trạng thái hợp lệ
    const statusFlow = {
      pending: ["processing", "cancelled"],
      processing: ["shipped"],
      shipped: ["completed"],
      completed: [],
      cancelled: []
    };

    if (!statusFlow[order.status].includes(newStatus)) {
      return res.status(400).json({ message: `Không thể chuyển từ ${order.status} sang ${newStatus}` });
    }

    await db.collection("orders").updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { status: newStatus } }
    );

    return res.json({ message: `Cập nhật trạng thái thành ${newStatus} thành công` });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi cập nhật trạng thái đơn hàng", error });
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
const addPrinter = async (req, res) => {
  try {
    const { Name, Type,Filament,Color,Size,url,api } = req.body;
    const db = getDB();
    const result = await db.collection('printer').insertOne({ 
      url,
      api,
      lasUpdated: new Date(),
      Printer:{Name, Type,Filament,Color,Size }});
    if (result.insertedCount === 0) {
      return res.status(500).json({ message: 'Lỗi khi thêm máy in' });
    }
    res.status(200).json({ message: 'Đã thêm máy in' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm máy in', error: error.message });
  }
}
const updatePrinter = async (req, res) => {
  try {
 
    const { Name, Type, Filament, Color, Size, url, api,id } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const db = getDB();
    const result = await db.collection('printer').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          url,
          api,
          lastUpdated: new Date(),
          Printer: { Name, Type, Filament, Color, Size }
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy máy in' });
    }

    res.status(200).json({ message: 'Cập nhật thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật máy in', error: error.message });
  }
};

const deletePrinter = async (req, res) => {
  try {
    const { id } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const db = getDB();
    const result = await db.collection('printer').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy máy in để xóa' });
    }

    res.status(200).json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa máy in', error: error.message });
  }
};

module.exports = { getAllUsers ,
  updateOrderStatus,getRevenueReport,getTopSellingProducts,getPromotionEffectiveness,
  updateProduct,addProduct,deleteProduct,
  addPrinter,updatePrinter,deletePrinter,getAllOrders};
