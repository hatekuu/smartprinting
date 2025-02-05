const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

const getCommandAndUpdateStatus = async (req, res) => {
  try {
    const { temperature, status, id ,setcommand } = req.body;
    
    const db = getDB();
    const updateField={};
    if(temperature) updateField.temperature=temperature;
    if(status) updateField.status=status; 
    if(setcommand) updateField.command=setcommand;
    if(!id) return res.status(400).json({ message: 'Chưa có id của máy in' });
    const updateResult = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateField },
      { upsert: true }
    );
  
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
const uploadGcodeFile = async (req, res) => {
  try {
    const { fileName, fileContent, printId } = req.body;
    const db = getDB();

    // Tìm tất cả các tài liệu có fileName và printId trùng với giá trị trong req.body, sắp xếp theo createdAt để lấy tài liệu mới nhất
    const documents = await db.collection('gcodefile')
      .find({ fileName, printId })
      .sort({ createdAt: -1 })  // Giả sử có trường createdAt để sắp xếp theo thời gian
      .toArray();

    let existingDoc = null;
    if (documents.length > 0) {
      existingDoc = documents[0]; // Lấy tài liệu cuối cùng (mới nhất)
    }

    if (existingDoc) {
      // Kiểm tra kích thước của fileContent đã có trong cơ sở dữ liệu
      const existingContentLength = existingDoc.fileContent ? existingDoc.fileContent.length : 0;

      // Nếu fileContent trong cơ sở dữ liệu có dung lượng > 5MB (5MB = 5 * 1024 * 1024 bytes)
      if (existingContentLength > 2 * 1024 * 1024) {
        // Dung lượng quá lớn, không thực hiện update mà chỉ thêm phần mới vào
        const result = await db.collection('gcodefile').insertOne({
          fileName,
          fileContent,
          printId,
          createdAt: new Date() // Thêm thời gian tạo tài liệu mới
        });

        if (result.insertedCount === 0) {
          return res.status(500).json({ message: 'Lỗi khi thêm phần tệp G-code' });
        }

        return res.status(200).json({ message: 'Đã tải lên phần tệp, đang chờ các phần còn lại...' });
      } else {
        // Dung lượng < 5MB, cập nhật thêm phần fileContent vào trường hiện tại
        const updatedContent = existingDoc.fileContent + fileContent;

        const result = await db.collection('gcodefile').updateOne(
          { _id: existingDoc._id },  // Dùng _id để chắc chắn cập nhật đúng tài liệu
          { $set: { fileContent: updatedContent } }
        );

        if (result.modifiedCount === 0) {
          return res.status(500).json({ message: 'Lỗi khi cập nhật phần tệp G-code' });
        }

        return res.status(200).json({ message: 'Đã cập nhật phần tệp, đang chờ các phần còn lại...' });
      }
    } else {
      // Nếu không tìm thấy tài liệu trùng với fileName và printId, thực hiện insertOne
      const result = await db.collection('gcodefile').insertOne({
        fileName,
        fileContent,
        printId,
        createdAt: new Date() // Thêm thời gian tạo tài liệu mới
      });

      if (result.insertedCount === 0) {
        return res.status(500).json({ message: 'Lỗi khi thêm phần tệp G-code' });
      }

      return res.status(200).json({ message: 'Đã tải lên phần tệp, đang chờ các phần còn lại...' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tải lên tệp G-code', error: error.message });
  }
};


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
const updateStatus = async (req, res) => {
  try {
    const {readed, printId } = req.body;
    const db = getDB(); 
    if(readed==false){
      return res.status(200).json({ message: 'Đã cập nhật trạng thái' });
    }
    if(readed==true){
      await db.collection('3dprint').updateOne(
        { _id: new ObjectId(printId) },
        { $set: { fileContent: "" } },
        { upsert: true }
      );
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
    
  }
}
module.exports = { getCommandAndUpdateStatus,uploadGcodeFile,sendCommand,addPrinter,updateStatus };