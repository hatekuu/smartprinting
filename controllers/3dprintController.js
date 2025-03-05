const { ObjectId  } = require('mongodb');
const { getPipelineFromDB } = require('../services/aggregationService');
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { getDB } = require('../config/db');
require('dotenv').config();
const postData= async (req,res)=>{
  const db=getDB()
  const {id,data}= req.body
  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID không hợp lệ hoặc thiếu ID' });
  }
  try {
    const updateResult = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(id) },
      { $set: {data:data} },
      { upsert: true }
    );
    if (updateResult.matchedCount === 0 && updateResult.upsertedCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu để cập nhật' });
    }
    return res.status(200).json({message:"Đã cập nhật thành công dữ liệu từ máy in"})
  } catch (error) {
    
  }
}
const getCommandAndUpdateStatus = async (req, res) => {
  let command = {}; // Tránh lỗi nếu có lỗi xảy ra trước khi command được gán giá trị
  try {
    const {  id } = req.body;
    
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ hoặc thiếu ID' });
    }
    const db = getDB();
    command = await db.collection('3dprint').findOne({ _id: new ObjectId(id) });
  
    if (command.state === "printing") {
      return res.status(200).json(command);
    }
    if (command.state === "printing_done") {
      if(command.fileList.length>0){
        await db.collection('3dprint').updateOne(
          { _id: new ObjectId(id) },
          { $set: { state: "printing" } }
        );
        command.state="printing"
        return res.status(200).json(command);
      }
      else{
        await db.collection('3dprint').updateOne(
          { _id: new ObjectId(id) },
          { $set: { state: "writing" } }
        );
             command.state="writing"
        return res.status(404).json({message:"đã in hết file trên máy"});
      }
   
    }
    
    if (!command) {
      return res.status(404).json({ message: 'Không tìm thấy lệnh' });
    }

    if (command.state === "writing_done"||command.state === "printing_done"||command.state === "printing") {
      command.log = "Hiện tại chưa có file mới hoặc đang in";
      return res.status(200).json(command);
    }

    if (command.state === "writing") {
      let maxsize = 2 * 1024 * 1024;
      let file = await db.collection('gcodefile').findOne({ printId: id, fileId: command.fileId,fileName: command.fileName });
      if (!file) {
        let newfile = await db.collection('gcodefile').findOne({ printId: id ,status:{$eq:"confirm"}});
        if (!newfile) {
          await db.collection('3dprint').updateOne(
            { _id: new ObjectId(id) },
            { $set: { state: "writing_done" } }
          );
          command.log = "Không tìm thấy file";
          return res.status(202).json(command);
        }
        await db.collection('3dprint').updateOne(
          { _id: new ObjectId(id) },
          { $set: { fileName: newfile.fileName ,fileId:newfile.fileId} }
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
            { $set: { fileContent: newfileContent } },
         
          );
        } else {
          await db.collection('3dprint').updateOne(
            { _id: new ObjectId(id) },
            { $push: { fileList: command.fileName } }
          );          
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
    const fileData = await db.collection('stlFile').findOne({ status: { $eq: 'done' }})
    if (!fileData) {
      return res.status(404).json({ message: 'Không tìm thấy file STL đã được xác nhận tải xuống' });
    }    
    const {fileId,userId,printId}=fileData
    const newFileName = userId + "_" + fileId+"_"+fileName; 
    if(process=='done'){
     await db.collection('stlFile').updateOne({fileId:fileId},{$set:{status:"order-not-confirm"}})

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
          fileName:newFileName,
          fileContent,
          printId,
          fileId,
          userId,
          status:"waiting-confirm",
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
          { $set: { fileContent: updatedContent,status:"pending" } }
        );

        if (result.modifiedCount === 0) {
          return res.status(500).json({ message: 'Lỗi khi cập nhật phần tệp G-code' });
        }

        return res.status(200).json({ message: 'Đã cập nhật phần tệp, đang chờ các phần còn lại...' });
      }
    } else {
      // Nếu không tìm thấy tài liệu trùng với fileName và printId, thực hiện insertOne
      const result = await db.collection('gcodefile').insertOne({
        fileName:newFileName,
        fileContent,
        printId,
        fileId,
        userId,
        status:"waiting-confirm",
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
    const { userId } = req.body;
    const db = getDB();
    const pipeline=await getPipelineFromDB("gcodePricingPipeline")
    if (!pipeline ) {
      return res.status(500).json({ message: "Pipeline không tồn tại!" });
    }
    const modifiedPipeline = pipeline.map(stage => {
      if (stage.$match ) {
        stage.$match.userId =userId;
      }
      return stage;
    });
    const gcodeFiles = await db.collection("gcodefile").aggregate(modifiedPipeline).toArray();

    if (gcodeFiles.length === 0) {
      return res.status(202).json({ message: "Không thể đọc thông số từ bất kỳ file G-code nào!" });
    }

    return res.status(200).json({
      message: "Tính giá thành công!",
      pricing: gcodeFiles
    });

  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xử lý giá!", error: error.message });
  }
};

   

const confirmOrder = async (req, res) => {
  try {
    const { fileId, printId, userId, confirm ,totalPrice,fileName,gcodeId} = req.body;
    const db = getDB();
  
    if (confirm) {
      // Nếu user đồng ý, tạo đơn hàng
      const order = {
        userId:new ObjectId(userId),
        printId,
        fileId,
        gcodeId,
        totalPrice,
        ordertype: "Dịch vụ in 3D",
        fileName,
        status: "pending", // Đơn hàng đang chờ xử lý
        createdAt: new Date()
      };
      await db.collection("orders").insertOne(order);
      await db.collection("gcodefile").updateOne({ _id:new ObjectId(gcodeId) }, { $set: { status: "confirm" } });
      await db.collection("3dprint").updateOne({ _id:new ObjectId(printId) }, { $set: { state: "writing" } });
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
 
    res.status(200).json(fileData );
  } catch (error) {
    res.status(500).json({ message: 'Error downloading STL file', error });
  }
}
const confirmDownload = async (req, res) => {
  try {
    const db = getDB();
    const { fileId, fileName } = req.body;

    if (!fileId || !fileName) {
      return res.status(400).json({ message: "fileId và fileName là bắt buộc" });
    }

    // Lấy thông tin file từ MongoDB
    const fileDoc = await db.collection("stlFile").findOne({ _id: new ObjectId(fileId) });

    if (!fileDoc) {
      return res.status(404).json({ message: "File không tồn tại" });
    }

    // Tìm index của file trong mảng `files`
    const index = fileDoc.files.findIndex(file => file.fileName === fileName);

    if (index === -1) {
      return res.status(404).json({ message: "File không tồn tại trong danh sách" });
    }

    // Lấy Google Drive file ID từ URL
    const url = fileDoc.files[index]?.fileContent; 
    const id = url.split("id=")[1]?.split("&")[0] || null;

    if (!id) {
      return res.status(400).json({ message: "Không tìm thấy Google Drive file ID" });
    }

    // Xóa file trên Google Drive
    await deleteFileFromGoogleDrive(id);

    // Cập nhật trạng thái của file trong danh sách `files`
    await db.collection("stlFile").updateOne(
      { _id: new ObjectId(fileId), "files.fileName": fileName },
      { $set: { "files.$.status": "done","files.$.fileContent": ""} }
    );
    // Kiểm tra nếu tất cả files đều có status là "done"
    const updatedDoc = await db.collection("stlFile").findOne({ _id: new ObjectId(fileId) });
    console.log(fileId)
    if (updatedDoc && updatedDoc.files.every(file => file.status === "done")) {
      await db.collection("stlFile").updateOne(
        { _id: new ObjectId(fileId) },
        { $set: { status: "done" } }
      );
    }

    res.json({ message: "Xác nhận tải xuống và đã xóa file khỏi Google Drive" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xác nhận tải xuống", error: error.message });
  }
};

const deleteFileFromGoogleDrive = async (driveFileId) => {
  try {
    const drive = authenticateGoogleDrive();
    await drive.files.delete({ fileId: driveFileId });
    console.log(`File ${driveFileId} deleted from Google Drive`);
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error.message);
  }
};
const sendCommand = async (req, res) => {
  try {
    const { command,printId } = req.body;
    const db = getDB();
    console.log(command)
    const result = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(printId) },
      { $set: { command:command}  })
    if (result.insertedCount === 0) {
      return res.status(500).json({ message: 'Lỗi khi gửi lệnh' });
    }
    res.status(200).json({ message: 'Đã gửi lệnh' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi lệnh', error: error.message });
  }
}
const filterPrint = async (req, res) => { 
  try {
    const db = getDB();
    const { Filament, Color, Size, type, sort } = req.body;
    let pipeline = [];
    let matchConditions = {};
    
    // Lấy pipeline mặc định từ collection "PrintForm"
    const pipeLineDB = await db.collection('aggregate').findOne({ _id: "PrintForm" });
    
    // Xây dựng điều kiện lọc
    if (Filament) {
      matchConditions["Printer.Filament"] = Filament;
    }
    if (Color) {
      matchConditions["Printer.Color"] = Color;
    }
    if (Size) {
      matchConditions["Printer.Size"] = Size;
    }

    // Nếu có bất kỳ điều kiện lọc nào, thêm vào pipeline
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }
    
    // Thêm PoweSort hoặc SortFileCount vào pipeline nếu có type và sort
    if (type && sort) {
      if (type === "power") {
        // Thêm PoweSort vào pipeline
        pipeLineDB.pipline.PoweSort.forEach(step => {
          if (step.$addFields) {
            step.$addFields.power = sort; // Thay power bằng giá trị sort
          }
          pipeline.push(step);
        });
      } else if (type === "file") {
        // Thêm SortFileCount vào pipeline
        pipeLineDB.pipline.SortFileCount.forEach(step => {
          if (step.$addFields) {
            step.$addFields.fileSort = sort; // Thay fileSort bằng giá trị sort
          }
          pipeline.push(step);
        });
      }
    }

    // Thêm filterInfo vào pipeline
    pipeline.push(...pipeLineDB.pipline.filterInfo);

    // Thực thi aggregate
    const result = await db.collection('3dprint').aggregate(pipeline).toArray();
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};



const updateStatus = async (req, res) => {
  try {
    const { status, printId } = req.body;
    const db = getDB();

    if (!status) {
      return res.status(200).json({ message: 'Không có giá trị' });
    }

    let updateQuery = { $set: { fileContent: "", state: status } };

    if (status === "printing_done") {
      updateQuery.$pop = { fileList: -1 }; // Xóa phần tử đầu tiên của mảng fileList
    }

    const result = await db.collection('3dprint').updateOne(
      { _id: new ObjectId(printId) },
      updateQuery,
      { upsert: false }
    );

    if (result.modifiedCount > 0) {
      return res.status(200).json({ message: 'Trạng thái đã được cập nhật' });
    } else {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu hoặc không có thay đổi' });
    }

  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
    }
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
const getFilePrint = async (req, res) => {
  try {
    const { printId } = req.body;
    const db = getDB();
    // Kiểm tra nếu không có printId
    if (!printId) {
      return res.status(400).json({ message: "printId is required" });
    }

    // Tìm tài liệu trong collection '3dprint'
    const result = await db.collection("3dprint").findOne({ _id: new ObjectId(printId) });

    // Kiểm tra nếu không tìm thấy tài liệu
    if (!result) {
      return res.status(404).json({ message: "Print job not found" });
    }

    // Trả về danh sách fileList
    return res.status(200).json({ fileList: result.fileList || [] ,filedata:result.data});

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Lỗi khi lấy danh sách file", error: error.message });
  }
};


// Hàm xác thực Google Drive
const authenticateGoogleDrive = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: process.env.GOOGLE_TYPE,
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: process.env.GOOGLE_AUTH_URI,
      token_uri: process.env.GOOGLE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
};

const CHUNK_DIR = "/tmp";
if (!fs.existsSync(CHUNK_DIR)) fs.mkdirSync(CHUNK_DIR, { recursive: true });
async function checkAndMergeChunks(fileName, totalChunks, quantity) {
  const filePath = `/tmp/${fileName}`;
  const chunkPaths = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = `/tmp/${fileName}.part${i}`;
    if (!fs.existsSync(chunkPath)) {
      console.log(`⏳ Chưa đủ chunk: ${chunkPath} không tồn tại`);
      return null;
    }
    chunkPaths.push(chunkPath);
  }

  console.log(`Merging ${totalChunks} chunks for ${fileName}...`);
  const writeStream = fs.createWriteStream(filePath);

  try {
    for (const chunkPath of chunkPaths) {
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on("end", resolve);
        readStream.on("error", reject);
      });
      console.log(`✅ Đã ghi chunk: ${chunkPath}`);
    }

    return new Promise((resolve, reject) => {
      writeStream.end(async () => {
        console.log(`🎉 File ${fileName} merged successfully.`);

        // Xóa các chunk sau khi ghi xong
        for (const chunkPath of chunkPaths) {
          await fs.promises.unlink(chunkPath);
        }
        console.log(`✅ Tất cả chunks đã bị xóa.`);

        try {
          const uploadResult = await uploadToDrive(fileName, filePath, quantity);
          resolve(uploadResult); // ✅ Trả về kết quả upload
        } catch (uploadError) {
          console.error("❌ Lỗi khi upload:", uploadError);
          reject(null);
        }
      });

      writeStream.on("error", (error) => {
        console.error("❌ Lỗi khi merge file:", error);
        reject(null);
      });
    });

  } catch (error) {
    console.error("❌ Lỗi khi merge file:", error);
    writeStream.destroy();
    return null;
  }
}

const uploadFile = async (req, res) => {
  const { file } = req;
  const { fileId, printId, userId, quantity, fileName, chunkIndex, totalChunks } = req.body;
  const db = getDB(); // Kết nối MongoDB
  if (fileName.length > 20 || /[<>:"\/\\|?*]/.test(fileName)) {
    return res.status(400).json({ error: "Tên file không hợp lệ" });
}
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const chunkPath = path.join(CHUNK_DIR, `${fileName}.part${chunkIndex}`);
    await fs.promises.copyFile(file.path, chunkPath);
    console.log(`Chunk ${chunkIndex}/${totalChunks} saved: ${chunkPath}`);

    // 🔥 Kiểm tra nếu đã nhận đủ chunk thì ghép file & upload
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
      const uploadResult = await checkAndMergeChunks(fileName, totalChunks, quantity);
      if (!uploadResult) {
        return res.status(500).json({ error: "Upload to Drive failed" });
      }

      // Cập nhật MongoDB với link Drive
      let fileDoc = await db.collection("stlFile").findOne({ fileId, printId, userId });

      if (!fileDoc) {
        fileDoc = { fileId, printId, userId, files: [], createdAt: new Date() };
        await db.collection("stlFile").insertOne(fileDoc);
      }

      let fileIndex = fileDoc.files.findIndex((f) => f.fileName === fileName);
      if (fileIndex === -1) {
        fileDoc.files.push({
          fileName,
          fileContent: uploadResult.webContentLink,
          quantity,
          createdAt: new Date(),
        });
        fileIndex = fileDoc.files.length - 1;
      } else {
        fileDoc.files[fileIndex].fileContent = uploadResult.webContentLink;
        fileDoc.files[fileIndex].quantity = quantity;
      }

      await db.collection("stlFile").updateOne(
        { fileId, printId, userId },
        { $set: { files: fileDoc.files, status: "waiting" } }
      );

      return res.status(200).json({
        message: "File uploaded successfully"
      });
    }

    return res.status(200).json({ message: `Chunk ${chunkIndex} received` });
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};
async function uploadToDrive(fileName, filePath, quantity) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: process.env.GOOGLE_TYPE,
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });
    const folderId = process.env.PARENT_ID;
    
    // 🛠️ Tạo tên file theo định dạng mong muốn
    const driveFileName = `X${quantity}-${fileName}`;
    const fileMetadata = { name: driveFileName, parents: [folderId] };
    const media = { mimeType: "application/octet-stream", body: fs.createReadStream(filePath) };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, webViewLink, webContentLink",
    });

    console.log(`Uploaded ${driveFileName} to Google Drive:`, response.data);

    if (response.status === 200) {
      await fs.promises.unlink(filePath); // Xóa file chỉ khi upload thành công
      console.log(`Deleted local file: ${filePath}`);
    }

    return response.data; // ✅ Trả về dữ liệu Google Drive
  } catch (error) {
    console.error("❌ Error uploading to Drive:", error);
    return null; // Trả về null nếu upload thất bại
  }
}
module.exports = {postData,uploadFile,getFilePrint ,
   getCommandAndUpdateStatus,uploadGcodeFile,sendCommand,updateStatus 
   ,getPrinter,confirmOrder,processGcodePricing,downloadStl,confirmDownload,filterPrint};
