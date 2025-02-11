const { ObjectId,GridFSBucket  } = require('mongodb');
const { Readable } = require('stream');

const { getDB } = require('../config/db');

const getCommandAndUpdateStatus = async (req, res) => {
  let command = {}; // Tránh lỗi nếu có lỗi xảy ra trước khi command được gán giá trị
  try {
    const { temperature, status, id, setcommand } = req.body;
    
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ hoặc thiếu ID' });
    }
    
    const db = getDB();
    const updateField = {};
    if (temperature) updateField.temperature = temperature;
    if (status) updateField.status = status;
    if (setcommand) updateField.command = setcommand;
    
    const updateResult = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateField },
      { upsert: true }
    );

    if (updateResult.matchedCount === 0 && updateResult.upsertedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu để cập nhật' });
    }

    command = await db.collection('3dprint').findOne({ _id: new ObjectId(id) });
    if (!command) {
      return res.status(404).json({ message: 'Không tìm thấy lệnh' });
    }

    if (command.state === "writing_done") {
      command.log = "Hiện tại chưa có file mới";
      return res.status(200).json(command);
    }

    if (command.state === "writing") {
      let maxsize = 2 * 1024 * 1024;
      let file = await db.collection('gcodefile').findOne({ printId: id, fileName: command.fileName });

      if (!file) {
        let newfile = await db.collection('gcodefile').findOne({ printId: id });
        if (!newfile) {
          await db.collection('3dprint').updateOne(
            { _id: new ObjectId(id) },
            { $set: { state: "writing_done" } }
          );
          command.log = "Không tìm thấy file";
          return res.status(404).json(command);
        }

        await db.collection('3dprint').updateOne(
          { _id: new ObjectId(id) },
          { $set: { fileName: newfile.fileName } }
        );
        return res.status(200).json(command);
      }

      if (file) {
        let filepart = file.fileContent.slice(0, maxsize);
      
        // Kiểm tra nếu ký tự cuối là \r, giảm maxsize xuống 3-4 ký tự
        if (filepart.endsWith("\r")) {
          maxsize -= Math.min(4, filepart.length); // Giảm 3-4 ký tự nhưng không vượt quá giới hạn
          filepart = file.fileContent.slice(0, maxsize);
        }
      
        command.fileContent = filepart;
      
        const newfileContent = file.fileContent.slice(maxsize);
        if (newfileContent.length > 0) {
          await db.collection('gcodefile').updateOne(
            { printId: id, fileName: command.fileName },
            { $set: { fileContent: newfileContent } }
          );
        } else {
          await db.collection('gcodefile').deleteOne({ printId: id, fileName: command.fileName });
        }
      }      
      
      return res.status(200).json(command);
    }
  } catch (error) {
    command.error = error.message;
    command.log = 'Lỗi khi lấy lệnh và cập nhật trạng thái';
    res.status(500).json(command);
  }
};

const uploadGcodeFile = async (req, res) => {
  try {
    const { fileName, fileContent,process } = req.body;
    const db = getDB();
    const fileData = await db.collection('stlFile').findOne({ status: { $eq: 'download_confirmed' }})
    if (!fileData) {
      return res.status(404).json({ message: 'Không tìm thấy file STL đã được xác nhận tải xuống' });
    }    
    const {fileId,userId,printId}=fileData
    if(process=='done'){
      await db.collection('stlFile').deleteOne({fileId:fileId})
    }
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
      if (existingContentLength > 5 * 1024 * 1024) {
        // Dung lượng quá lớn, không thực hiện update mà chỉ thêm phần mới vào
        const result = await db.collection('gcodefile').insertOne({
          fileName,
          fileContent,
          printId,
          fileId,
          userId,
          status:"pending",
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
        fileId,
        userId,
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
const processGcodePricing = async (req, res) => {
  try {
    const {  userId } = req.body;
    const db = getDB();

    // Lấy tất cả file G-code thỏa mãn điều kiện
    const gcodeFiles = await db.collection("gcodefile").find({  userId, status:{$eq:"pending"},confirmed:{$ne:'yes'} }).toArray();

    if (gcodeFiles.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy file G-code!" });
    }

    // Duyệt qua từng file, lọc các file hợp lệ và tính tiền
    const pricingResults = gcodeFiles
      .map(gcodeFile => {
        const gcodeContent = gcodeFile.fileContent;
        const fileName = gcodeFile.fileName;
        const fileId=gcodeFile.fileId
        const printId=gcodeFile.printId
        // Tìm thời gian in và lượng filament sử dụng
        const timeMatch = gcodeContent.match(/;TIME:(\d+)/);
        const filamentMatch = gcodeContent.match(/;Filament used:\s*(\d+\.?\d*)m/);

        // Nếu không có thông tin cần thiết, bỏ qua file này
        if (!timeMatch || !filamentMatch) return null;

        const printTime = parseInt(timeMatch[1]); // Thời gian in (giây)
        const filamentUsed = parseFloat(filamentMatch[1]); // Lượng filament (mét)

        // Giá theo thời gian và vật liệu (ví dụ: 50 đồng/phút, 200 đồng/mét filament)
        const pricePerMinute = 50;
        const pricePerMeter = 200;
        const totalPrice = (printTime / 60) * pricePerMinute + filamentUsed * pricePerMeter;

        return {
          printId,
          fileId,
          fileName,
          price: totalPrice,
          printTime,
          filamentUsed
        };
      })
      .filter(result => result !== null); // Loại bỏ các phần tử null

    if (pricingResults.length === 0) {
      return res.status(400).json({ message: "Không thể đọc thông số từ bất kỳ file G-code nào!" });
    }

    return res.status(200).json({
      message: "Tính giá thành công!",
      pricing: pricingResults
    });

  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xử lý giá!", error: error.message });
  }
};

const confirmOrder = async (req, res) => {
  try {
    const { fileId, printId, userId, confirm ,price,fileName} = req.body;
    const db = getDB();
  
    if (confirm) {
      // Nếu user đồng ý, tạo đơn hàng
      const order = {
        userId:new ObjectId(userId),
        printId,
        fileId,
        price,
        fileName,
        status: "pending", // Đơn hàng đang chờ xử lý
        createdAt: new Date()
      };
      await db.collection("orders").insertOne(order);
      await db.collection("gcodefile").updateOne({ fileId, printId }, { $set: { confirmed: "yes" } },{upsert:true});
      return res.status(200).json({ message: "Đơn hàng đã được tạo!" });
    } else {
      // Nếu user từ chối, xóa dữ liệu liên quan
      await db.collection("stlFile").deleteMany({ fileId, printId, userId });
      await db.collection("gcodefile").deleteMany({ fileId, printId });
      return res.status(200).json({ message: "Dữ liệu đã được xóa!" });
    }
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xử lý xác nhận đơn hàng!", error: error.message });
  }
};
const downloadStl = async(req,res)=>{
  try {
    const db=getDB()
    const fileData= await db.collection('stlFile').findOne({ status: { $eq: 'waiting'  }});
    if (!fileData) {
      return res.status(200).json({ message: 'No available STL file for download' });
  }
 
res.json( fileData );
  } catch (error) {
    res.status(500).json({ message: 'Error downloading STL file', error });
  }
}
const confirmDonwload= async(req,res)=>{
  try {
    const db=getDB()
    const { fileId } = req.body;


    if (!fileId) {
      return res.status(400).json({ message: 'fileId is required' });
  }
   // Cập nhật trạng thái thành "download_confirmed"
      const result = await db.collection("stlFile").updateOne(
        { _id: new ObjectId(fileId), status: "downloading" },
        { $set: { status: "download_confirmed" } }
      );
    res.json({ message: 'Download confirmed' });
  } catch (error) {
    res.status(500).json({ message: 'Error confirming download', error });
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

const updateStatus = async (req, res) => {
  try {
    const { readed, printId } = req.body;
    const db = getDB();
    
    // Validate that 'readed' is a boolean
    if (typeof readed !== 'boolean') {
      return res.status(400).json({ message: 'Invalid value for readed' });
    }

    // If 'readed' is false, just return the message
    if (!readed) {
      return res.status(200).json({ message: 'Đã cập nhật trạng thái' });
    }

    // If 'readed' is true, clear the file content in the document
    await db.collection('3dprint').updateOne(
      { _id: new ObjectId(printId) },
      { $set: { fileContent: "" ,state:"writing_done"} },
      { upsert: false } // Setting upsert to false unless you really want to insert a new doc if not found
    );

    res.status(200).json({ message: 'Trạng thái đã được cập nhật' });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
  }
};
const getPrinter = async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection('3dprint').find().project({ Printer: 1, _id: 1 }).toArray();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
const uploadStlChunk = async (req, res) => {
  try {
    const { chunk, chunkIndex, totalChunks, fileId, fileName, printId, userId, quantity } = req.body;
    const db = getDB();

    if (!chunk || !fileId || !fileName || !printId || !userId || chunkIndex === undefined || totalChunks === undefined) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ!" });
    }

    // Tìm document theo fileId và printId
    let fileDoc = await db.collection("stlFile").findOne({ fileId, printId, userId });

    // Nếu document chưa tồn tại, tạo mới
    if (!fileDoc) {
      fileDoc = {
        fileId,
        printId,
        userId,
        files: [],
        createdAt: new Date(),
      };
      await db.collection("stlFile").insertOne(fileDoc);
    }

    // Kiểm tra file đã tồn tại trong `files` chưa
    let fileIndex = fileDoc.files.findIndex((f) => f.fileName === fileName);

    if (fileIndex === -1) {
      // Nếu file chưa có, thêm mới
      fileDoc.files.push({
        fileName,
        chunks: [],
        status:'waiting',
        totalChunks,
        completed: false,
      });
      fileIndex = fileDoc.files.length - 1;
    }

    // Lưu chunk vào file
    fileDoc.files[fileIndex].chunks.push({ chunkIndex, data: chunk });

    // Cập nhật document trong MongoDB
    await db.collection("stlFile").updateOne(
      { fileId, printId, userId },
      { $set: { files: fileDoc.files } }
    );

    // Kiểm tra nếu đã nhận đủ chunk
    if (fileDoc.files[fileIndex].chunks.length === totalChunks) {
      // Sắp xếp chunk theo `chunkIndex`
      fileDoc.files[fileIndex].chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Ghép thành base64 hoàn chỉnh
      const base64Data = fileDoc.files[fileIndex].chunks.map((c) => c.data).join("");

      // Cập nhật nội dung file và xóa chunks
      fileDoc.files[fileIndex].fileContent = base64Data;
      fileDoc.files[fileIndex].completed = true;
      fileDoc.files[fileIndex].quantity = quantity;
      delete fileDoc.files[fileIndex].chunks;

      await db.collection("stlFile").updateOne(
        { fileId, printId, userId },
        { $set: { files: fileDoc.files } }
      );

      return res.status(200).json({ message: `File ${fileName} uploaded successfully!` });
    }

    res.status(200).json({ message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded!` });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tải lên chunk!", error: error.message });
  }
};
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file nào được tải lên' });
    }

    const db = getDB(); // Lấy MongoDB từ app
    const bucket = new GridFSBucket(db, { bucketName: 'files' });

    // Chuyển file Buffer thành stream
    const readableStream = new Readable();
    readableStream.push(req.file.buffer);
    readableStream.push(null);

    const uploadStream = bucket.openUploadStream(req.file.originalname);
    readableStream.pipe(uploadStream);

    uploadStream.on('finish', () => {
      res.json({ message: 'Upload thành công!', fileName: req.file.originalname });
    });

    uploadStream.on('error', (err) => {
      console.error('Lỗi khi lưu file:', err);
      res.status(500).json({ error: 'Lỗi khi upload file' });
    });

  } catch (error) {
    console.error('Lỗi server:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};
module.exports = { getCommandAndUpdateStatus,uploadGcodeFile,sendCommand,updateStatus ,getPrinter,uploadStlChunk,confirmOrder,processGcodePricing,downloadStl,confirmDonwload,uploadFile};
