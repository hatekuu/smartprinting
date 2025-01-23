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

    res.json({ products, currentPage: pageValue });
  } catch (error) {
    console.error('Lỗi lấy danh sách sản phẩm:', error.message);
    res.status(500).json({ message: 'Lỗi lấy danh sách sản phẩm' });
  }
};
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

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
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, stock } = req.body;

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

module.exports = { getProducts, getProductById, addProduct, updateProduct};
 