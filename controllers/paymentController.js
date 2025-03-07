const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();
var accessKey = 'F8BBA842ECF85';
var secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
const payment=async(req,res)=>{
//https://developers.momo.vn/#/docs/en/aiov2/?id=payment-method
//parameters
const {amount,orderType}=req.body
var orderInfo = 'pay with MoMo';
var partnerCode = 'MOMO';
if(orderType=="3dPrint"){
    var redirectUrl = `${process.env.URL}/smart3D/products/bills`;
}else if(orderType=="products"){
    var redirectUrl = `${process.env.URL}/smart3D/products/cart`;
}

var ipnUrl = process.env.CALL_BACK;
var requestType = "payWithMethod";

var orderId = partnerCode + new Date().getTime();
var requestId = orderId;
var extraData ='';
var orderGroupId ='';
var autoCapture =true;
var lang = 'vi';

//before sign HMAC SHA256 with format
//accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
var rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + ipnUrl + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&partnerCode=" + partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;

//signature
const crypto = require('crypto');
var signature = crypto.createHmac('sha256', secretKey)
    .update(rawSignature)
    .digest('hex');


//json object send to MoMo endpoint
const requestBody = JSON.stringify({
    partnerCode : partnerCode,
    partnerName : "Test",
    storeId : "MomoTestStore",
    requestId : requestId,
    amount : amount,
    orderId : orderId,
    orderInfo : orderInfo,
    redirectUrl : redirectUrl,
    ipnUrl : ipnUrl,
    lang : lang,
    requestType: requestType,
    autoCapture: autoCapture,
    extraData : extraData,
    orderGroupId: orderGroupId,
    signature : signature
});

const options={
    method:"POST",
    url:"https://test-payment.momo.vn/v2/gateway/api/create",
    headers:{
        "Content-Type":"application/json",
        "Content-Length":Buffer.byteLength(requestBody)
    },
    data:requestBody
}   
let result
try {
    result = await axios(options);
    return res.status(200).json(result.data);
} catch (error) {
    console.error("Payment request error:", error.response ? error.response.data : error.message);
    return res.status(400).json({
        message: 'Payment request failed',
        error: error.response ? error.response.data : error.message
    });
}

}
const paymentCallback=async(req,res)=>{
    try {
        const db=getDB()
        await db.collection('payment').insertOne(req.body)
        return res.status(200).json({message:"success"})
    } catch (error) {
        console.log(error)
        return res.status(400).json({message:"error"})
    }
}
const transactionStatus=async(req,res)=>{
    const db=getDB()
    const {orderId,userId,orderType} = req.body

    const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=MOMO&requestId=${orderId}`
    const signature =crypto.createHmac('sha256',secretKey).update(rawSignature).digest('hex')
    const requestBody = JSON.stringify({
        partnerCode : 'MOMO',
        orderId : orderId,
        requestId : orderId,
        signature : signature,
        lang: 'vi'
    })
    const options={
        method:"POST",
        url:"https://test-payment.momo.vn/v2/gateway/api/query",
        headers:{
            "Content-Type":"application/json",
            "Content-Length":Buffer.byteLength(requestBody)
        },
        data:requestBody
    }
    // let result
    try {
        result = await axios(options)
    
            if(result.data.resultCode ==0){
                if(orderType=="3dPrint"){
                    await db.collection('orders').updateOne(
                        { userId: new ObjectId(userId), status: 'paynt', paymentMethod: "Momo" },
                        { $set: { orderId: orderId, status: 'pending' } } 
                    );
                    
                    await db.collection("gcodefile").updateMany({ userId:userId }, { $set: { status: "confirm" } });
                    const file= await db.collection("gcodefile").findOne({userId:userId})
                    const printId=file.printId
                    await db.collection("3dprint").updateOne({ _id: new ObjectId(printId) }, { $set: { state: "writing" } });
         
                }
                else if(orderType=="products"){
                    await db.collection('orders').updateOne({ userId: new ObjectId(userId), status: 'pending',paymentMethod:"Momo" }, { $set: { orderId: orderId } });
                    await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { cart: {} } });
                }
            }
            else{
                if(orderType=="3dPrint"){
                    await db.collection("orders").deleteOne({userId:userId,status:"pending"})
                }
                else if(orderType=="products"){
                    await db.collection("orders").deleteOne({userId:userId,status:"paynt"})
                }
               
            }
      
                
            return res.status(200).json(result.data)
      
      
          
       
  
     
    } catch (error) {
        return res.status(400).json(error)
    }
}
module.exports = {payment,paymentCallback,transactionStatus}
