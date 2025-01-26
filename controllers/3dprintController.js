const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

const getCommandAndUpdateStatus = async (req, res) => {
  try {
    const { temperature, status, id ,readed,setcommand } = req.body;

    const db = getDB();
    const updateResult = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(id) },
      { $set: { temperature, status,command:setcommand } },
      { upsert: true }
    );
    if(readed==true){
      await db.collection('3dprint').updateOne(
        { _id: new ObjectId(id) },
        { $set: { fileContent: "" } },
        { upsert: true }
      );
    }
    if (updateResult.matchedCount === 0 && updateResult.upsertedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu để cập nhật' });
    }

    const command = await db.collection('3dprint').findOne({ _id: new ObjectId(id) });

    if (!command) {
      return res.status(404).json({ message: 'Không tìm thấy lệnh' });
    }

    const file = await db.collection('gcodefile').findOne({ fileName: command.fileName, printId: id });
    let responseMessage = 'Đã cập nhật trạng thái máy in';
    let fileContent = null;

    if (file) {
      await db.collection('3dprint').updateOne(
        { _id: new ObjectId(id) },
        { $set: { fileContent: file.fileContent } },
        { upsert: true }
      );
      await db.collection('gcodefile').deleteOne({ fileName: command.fileName, printId: id });
      responseMessage = 'Đã cập nhật nội dung file G-code';
      fileContent = file.fileContent;
    } else {
      const newFiles = await db.collection('gcodefile').find({ printId: id }).toArray();
      if (newFiles.length > 0) {
        await db.collection('3dprint').updateOne(
          { _id: new ObjectId(id) },
          { $set: { fileName: newFiles[0].fileName, fileContent: newFiles[0].fileContent } },
          { upsert: true }
        );
        await db.collection('gcodefile').deleteOne({ fileName: newFiles[0].fileName, printId: id });
        responseMessage = 'Đã cập nhật nội dung file G-code mới';
        fileContent = newFiles[0].fileContent;
      } else {
        responseMessage = 'Không tìm thấy file G-code mới cho ID in';
      }
    }

    res.status(200).json({ message: responseMessage, command });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy lệnh', error: error.message });
  }
};
const uploadGocdeFile = async (req, res) => {
  try {
    const { fileName, fileContent, printId } = req.body;
    const db = getDB();
    const result = await db.collection('gcodefile').insertOne({ fileName, fileContent, printId });
    if (result.insertedCount === 0) {
      return res.status(500).json({ message: 'Lỗi khi thêm file G-code' });
    }
    res.status(200).json({ message: 'Đã thêm file G-code' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm file G-code', error: error.message });
  }
}
const sendCommand = async (req, res) => {
  try {
    const { command,id } = req.body;
    const db = getDB();
    const result = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(id) },
      { $set: { command } },
      { upsert: true })
    if (result.insertedCount === 0) {
      return res.status(500).json({ message: 'Lỗi khi gửi lệnh' });
    }
    res.status(200).json({ message: 'Đã gửi lệnh' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi lệnh', error: error.message });
  }
}
const addPrinter = async (req, res) => {
  try {
    const { name, type,filamentColer,size } = req.body;
    const db = getDB();
    const result = await db.collection('printer').insertOne({ name, type,filamentColer,size });
    if (result.insertedCount === 0) {
      return res.status(500).json({ message: 'Lỗi khi thêm máy in' });
    }
    res.status(200).json({ message: 'Đã thêm máy in' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm máy in', error: error.message });
  }
}
module.exports = { getCommandAndUpdateStatus,uploadGocdeFile,sendCommand,addPrinter };