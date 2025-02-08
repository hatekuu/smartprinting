const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

const getProducts = async (req, res) => {
  try {
    const { limit = 10, page = 1, sortBy = 'name', order = 'asc' } = req.query;

    // Chuyển đổi thành số
    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const orderValue = order === 'asc' ? 1 : -1;

    const db = getDB();
    const products = await db
      .collection('products')
      .find({})
      .sort({ [sortBy]: orderValue }) // Sắp xếp theo sortBy
      .skip((pageValue - 1) * limitValue) // Bỏ qua sản phẩm của trang trước
      .limit(limitValue) // Giới hạn số sản phẩm
      .toArray();

    const totalProducts = await db.collection('products').countDocuments();

    res.json({ products, currentPage: pageValue, totalProducts });
  } catch (error) {
    console.error('Lỗi lấy danh sách sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi lấy danh sách sản phẩm' });
  }
};
const getProductById = async (req, res) => {
  try {
    const { id } = req.body;

    const db = getDB();
    const product = await db.collection('products').findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    res.json(product);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi lấy thông tin sản phẩm' });
  }
};

const findProduct = async (req, res) => {
  try {
    const { name, page = 1, limit = 10 } = req.body; // Thêm phân trang
    const db = getDB();

    const regex = new RegExp(name, 'i'); // Không phân biệt hoa thường

    const products = await db.collection('products')
      .find({ $or: [{ name: regex }, { description: regex }] }) // Tìm trong cả tên & mô tả
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();

    return res.json({ products, total: products.length }); 
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tìm kiếm sản phẩm', error });
  }
};

const suggestKeyword = async (req, res) => {  
  try {
    const { key } = req.body;
    const db = getDB(); 

    const keywords = await db.collection('products')
      .find({ name: new RegExp(key, 'i') }) // Chỉ lấy từ khóa có liên quan
      .limit(10) // Giới hạn số lượng gợi ý
      .project({ name: 1, _id: 0 }) // Chỉ lấy trường 'name', bỏ '_id'
      .toArray();

    return res.json(keywords.map(p => p.name)); // Chỉ trả về mảng tên sản phẩm
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi gợi ý từ khóa', error });
  }
};
// 1️⃣ Thêm sản phẩm vào giỏ hàng
const addToCart = async (req, res) => {
  try {
    const { productId, quantity, userId } = req.body;

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(productId) || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const db = getDB();

    // Kiểm tra sản phẩm có tồn tại không
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ message: 'Sản phẩm không tồn tại hoặc đã hết' });
    }

    // Kiểm tra user có tồn tại không
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    // Cập nhật giỏ hàng
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId), 'cart.products.productId': new ObjectId(productId) },
      { $inc: { 'cart.products.$.quantity': quantity } }
    );

    // Nếu sản phẩm chưa có trong giỏ hàng, thêm mới
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId), 'cart.products.productId': { $ne: new ObjectId(productId) } },
      {
        $push: {
          'cart.products': { productId: new ObjectId(productId), quantity }
        }
      }
    );

    return res.json({ message: 'Đã thêm vào giỏ hàng' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi thêm vào giỏ hàng', error });
  }
};
// 2️⃣ Xóa sản phẩm khỏi giỏ hàng
const removeFromCart = async (req, res) => {
  try {
    const { productId, userId } = req.body;

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const db = getDB();

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { 'cart.products': { productId: new ObjectId(productId) } } }
    );

    return res.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi xóa sản phẩm', error });
  }
};

// 3️⃣ Cập nhật số lượng sản phẩm
const updateCart = async (req, res) => {
  try {
    const { productId, quantity, userId } = req.body;

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(productId) || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const db = getDB();

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId), 'cart.products.productId': new ObjectId(productId) },
      { $set: { 'cart.products.$.quantity': quantity } }
    );

    return res.json({ message: 'Cập nhật giỏ hàng thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi cập nhật giỏ hàng', error });
  }
};
const getDiscount = async (req,res)=>{
  try {
    const db = getDB();
    const discount= await db.collection('discounts').find({}).toArray();
    return res.status(200).json(discount)
  } catch (error) {
    return res.status(500).json({message:"lỗi:",error})
  }
}
// 4️⃣ Tính tổng tiền và áp dụng mã giảm giá
const applyDiscount = async (req, res) => {
  try {
    const { discountCode, userId } = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const db = getDB();

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user || !user.cart || !user.cart.products || user.cart.products.length === 0) {
      return res.status(404).json({ message: 'Giỏ hàng trống' });
    }

    // Cập nhật giỏ hàng với mã giảm giá
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { 'cart.code': discountCode } },
      { upsert: true }
    );

    // Thực hiện aggregation
    const result = await db.collection('users').aggregate([
      {
        $match: {
          _id: new ObjectId(userId)
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'cart.products.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $lookup: {
          from: 'discounts',
          localField: 'cart.code',
          foreignField: 'code',
          as: 'discounts'
        }
      },
      {
        $set: {
          products: {
            $map: {
              input: '$cart.products',
              as: 'product',
              in: {
                $mergeObjects: [
                  '$$product',
                  {
                    price: {
                      $arrayElemAt: [
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: "$productDetails", 
                                as: "productDetail",
                                cond: {
                                  $eq: [
                                    "$$productDetail._id", 
                                    "$$product.productId"  
                                  ]
                                }
                              }
                            },
                            as: "filteredProduct",
                            in: "$$filteredProduct.price" 
                          }
                        },
                        0 
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
       {$project: {
     "products":1,
    "discounts": { $arrayElemAt: ["$discounts", 0] }

   }},
   
      {
        $addFields: {
          totalAmount: {
            $sum: {
              $map: {
                input: '$products',
                as: 'product',
                in: {
                  $multiply: [
                    '$$product.quantity',
                    '$$product.price'
                  ]
                }
              }
            }
          }
        }
      },
      {
        $project: {
          totalAmountWithDiscount: {
            $subtract:[
              "$totalAmount",{
            $multiply: [
              '$totalAmount',
              {
                $divide: [
                  '$discounts.discountPercentage',
                  100
                ]
              }
            ]}]
          }
        }
      }
         
    ], { maxTimeMS: 60000, allowDiskUse: true }).toArray();
    

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Lỗi áp dụng mã giảm giá', error });
  }
};


// 5️⃣ Xác nhận đơn hàng
const checkout = async (req, res) => {
  try {
    const { userId,address,discount } = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const db = getDB();

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user || !user.cart || !user.cart.products || user.cart.products.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // Tạo đơn hàng
    const order = {
      userId: new ObjectId(userId),
      products: user.cart.products,
      address: Number(address),
      status: 'pending',
      createdAt: new Date(),
      ...(discount ? { discount: discount } : {}) // Nếu discount có giá trị, thêm vào object
    };
    
    const result = await db.collection('orders').insertOne(order);
    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { 'cart.products': [] } });

    return res.json({ message: 'Đơn hàng đã được xác nhận', orderId: result.insertedId });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi xác nhận đơn hàng', error });
  }
};
// 6️⃣ Lấy danh sách sản phẩm trong giỏ hàng
const getCart = async (req, res) => {
  try {
    const { userId } = req.body;
    const db = getDB();

    // Lấy thông tin người dùng từ database
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    // Kiểm tra giỏ hàng có sản phẩm hay không
    if (!user.cart.products || user.cart.products.length === 0) {
      return res.json({ message: 'Giỏ hàng trống', items: [] });
    }

    // Lấy tất cả productIds và quantity từ giỏ hàng
    const productIds = user.cart.products.map(product => product.productId);
    const quantities = user.cart.products.map(product => product.quantity);

    // Tìm tất cả các sản phẩm có _id trong mảng productIds
    const products = await db.collection('products').find({ _id: { $in: productIds } }).toArray();

    // Gắn thêm quantity vào mỗi sản phẩm
    const cartItems = products.map(product => {
     
      const index = productIds.findIndex(id => {
        return id.equals(product._id);
      });
      return {
        ...product,
        quantity: quantities[index], // Thêm quantity tương ứng
      };
    });
    

    return res.json(cartItems); // Trả về danh sách sản phẩm có thêm quantity
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy giỏ hàng', error });
  }
};


// 5️⃣ Đánh giá sản phẩm
const reviewProduct = async (req, res) => {
  try {
    const { userId, productId, rating, comment } = req.body;
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(productId) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }
    const db = getDB();
    await db.collection('reviews').insertOne({ userId: new ObjectId(userId), productId: new ObjectId(productId), rating, comment, createdAt: new Date() });
    return res.json({ message: 'Đánh giá thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi đánh giá sản phẩm', error });
  }
};
// 4️⃣ Yêu cầu đổi/trả hàng
const requestReturn = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    if (!ObjectId.isValid(orderId) || !reason) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }
    const db = getDB();
    await db.collection('returns').insertOne({ orderId: new ObjectId(orderId), reason, status: 'đang xử lý', createdAt: new Date() });
    return res.json({ message: 'Yêu cầu đổi/trả đã được gửi' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi yêu cầu đổi/trả', error });
  }
};
// 3️⃣ Hủy đơn hàng
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }
    const db = getDB();
    const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (!order || order.status !== 'chờ xử lý') {
      return res.status(400).json({ message: 'Không thể hủy đơn hàng này' });
    }
    await db.collection('orders').deleteOne({ _id: new ObjectId(orderId) });
    return res.json({ message: 'Đơn hàng đã bị hủy' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi hủy đơn hàng', error });
  }
};

module.exports = {getDiscount,suggestKeyword,findProduct, getProducts, getProductById,addToCart,removeFromCart,updateCart,applyDiscount,checkout,getCart,reviewProduct,requestReturn,cancelOrder};
 