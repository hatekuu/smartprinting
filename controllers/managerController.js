const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const { getPipelineFromDB } = require('../services/aggregationService');

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
    const { name, price,costPrice, description, stock,category } = req.body;
    if (!name || !price || !description ) {
      return res.status(400).json({ message: 'Thiếu thông tin sản phẩm' });
    }
    const db = getDB();
    const existingProduct = await db.collection('products').findOne({ name });
    if (existingProduct) {
      return res.status(400).json({ message: 'Sản phẩm đã tồn tại' });
    }
    const result = await db.collection('products').insertOne({
      name,
      price,
      costPrice,
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
    const { _id, name, price,costPrice, description, stock,category } = req.body;

    if (!_id || !ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (name) updateData.category = category;
    if (price) updateData.price = Number(price);
    if (costPrice) updateData.price = Number(costPrice);
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

  
    const pipelineDoc = await getPipelineFromDB("getAllOrdersPipeline")
    // Truy vấn tất cả đơn hàng, sắp xếp theo trạng thái + thời gian
    const orders = await db.collection("orders")
    .aggregate(pipelineDoc)
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
    const { Name, Type, Filament, Color, Size, url, api, printInfo } = req.body;
  
    const db = getDB();
    if (!Name || !Type || !Filament || !Color || !Size || !url || !api||!printInfo) {
      return res.status(400).json({ message: 'Thiếu thông tin máy in' });
    }
    
    const result = await db.collection('3dprint').insertOne({
      url,
      api,
      fileList: [],
      fileContent: "",
      state: "",
      fileId: "",
      command: "",
      lastUpdated: new Date(),
      Printer: { Name, Type, Filament, Color, Size },
      printInfo: printInfo || {} // Thêm printInfo vào đây
    });

    if (result.insertedCount === 0) {
      return res.status(500).json({ message: 'Lỗi khi thêm máy in' });
    }

    res.status(200).json({ message: 'Đã thêm máy in' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm máy in', error: error.message });
  }
};

const updatePrinter = async (req, res) => {
  try {
    const { Name, Type, Filament, Color, Size, url, api, id, printInfo } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const db = getDB();

    const result = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          url,
          api,
          lastUpdated: new Date(),
          Printer: { Name, Type, Filament, Color, Size },
          printInfo: printInfo || {} // Thêm printInfo vào đây
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy máy in' });
    }

    res.status(200).json({ message: 'Cập nhật thành công', result });
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

const getPrinter = async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection('3dprint').find().toArray();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const calculateRevenueByTime = async (req, res) => {
  const { category, startDate, endDate, page = 1, limit = 10 } = req.body;
console.log(req.body)
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Vui lòng cung cấp startDate và endDate!" });
  }

  try {
    const db = getDB();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    // Lấy pipeline từ MongoDB
    let aggregationDoc = await getPipelineFromDB("revenueByCategory");
    if (!aggregationDoc) {
      return res.status(404).json({ error: "Aggregation pipeline không tồn tại" });
    }

    // Tạo bản sao để tránh sửa trực tiếp pipeline trong MongoDB
    const pipeline = JSON.parse(JSON.stringify(aggregationDoc));

    // Thay thế các giá trị động vào pipeline
    const modifiedPipeline = pipeline.map(stage => {
      if (stage.$match && stage.$match.createdAt) {
        stage.$match.createdAt = { $gte: start, $lte: end };
      }
      if (category&&category!="None" && stage.$match && stage.$match["productDetails.category"]) {
        stage.$match["productDetails.category"] = category;
      }
        // Nếu không có category, loại bỏ điều kiện lọc category
        if (category=="None"  && stage.$match && stage.$match["productDetails.category"]) {
          stage.$match["productDetails.category"] = category;
          delete stage.$match["productDetails.category"];
        }
      
      return stage;
    }).filter(stage => !(stage.$match && Object.keys(stage.$match).length === 0));

    // Thêm `$facet` để tính tổng sản phẩm
    modifiedPipeline.push({
      "$facet": {
        "data": [
          { "$sort": { "totalRevenue": -1 } },
          { "$skip": skip },
          { "$limit": parseInt(limit) }
        ],
        "totalCount": [
          { "$group": { "_id": null, "total": { "$sum": 1 } } }
        ]
      }
    });

    // Thực hiện aggregation trên collection "orders"
    const results = await db.collection("orders").aggregate(modifiedPipeline).toArray();

    // Tính tổng số trang dựa trên số lượng sản phẩm trong danh mục
    const totalProducts = results[0].totalCount.length ? results[0].totalCount[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    res.json({ data: results[0].data, totalPages });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = { getAllUsers ,
  updateOrderStatus,getRevenueReport,getTopSellingProducts,getPromotionEffectiveness,
  updateProduct,addProduct,deleteProduct,
  addPrinter,updatePrinter,deletePrinter,getAllOrders,getPrinter,calculateRevenueByTime};
