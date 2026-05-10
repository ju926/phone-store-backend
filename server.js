const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const axios = require("axios");
const path = require("path");

const app = express();

app.use(cors({ origin:"*" }));
app.use(express.json());
app.use(express.static(__dirname));

/* ================= HEALTH ================= */
app.get("/", (req,res)=>{
res.send("🚀 MALONE SERVER RUNNING");
});

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= ORDER MODEL ================= */
const Order = mongoose.model("Order",{
orderId:String,
phone:String,
items:Array,
total:Number,
status:{type:String,default:"Pending"},
date:{type:Date,default:Date.now}
});

/* ================= SASAPAY PAYMENT ================= */
app.post("/sasapay/pay", async (req,res)=>{

try{

const {phone,total,items} = req.body;

/* GET TOKEN */
const tokenRes = await axios.post(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{},
{
auth:{
username: process.env.SASAPAY_CLIENT_ID,
password: process.env.SASAPAY_CLIENT_SECRET
}
}
);

const token = tokenRes.data.access_token;

/* ORDER ID */
const orderId = "ORDER_" + Date.now();

/* PAYMENT REQUEST */
const payment = await axios.post(
"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
{
MerchantCode: process.env.SASAPAY_MERCHANT_CODE,
PhoneNumber: phone,
Amount: total,
Currency: "KES",
TransactionReference: orderId,
CallBackURL: "https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
},
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

/* SAVE ORDER */
await Order.create({
orderId,
phone,
items,
total,
status:"Pending"
});

res.json({
success:true,
data:payment.data
});

}catch(err){

console.log("SASAPAY ERROR:", err.response?.data || err.message);

res.status(500).json({
error:"Payment failed"
});

}

});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req,res)=>{

try{

const status = req.body?.status;
const orderId = req.body?.TransactionReference;

console.log("CALLBACK:", req.body);

if(status === "Success"){

await Order.findOneAndUpdate(
{orderId},
{status:"Paid"}
);

return res.redirect("/confirm.html?orderId="+orderId);

}

await Order.findOneAndUpdate(
{orderId},
{status:"Failed"}
);

return res.redirect("/failed.html");

}catch(err){

console.log(err);

return res.redirect("/failed.html");

}

});

/* ================= HTML ================= */
app.get("/confirm.html",(req,res)=>{
res.sendFile(path.join(__dirname,"confirm.html"));
});

app.get("/failed.html",(req,res)=>{
res.sendFile(path.join(__dirname,"failed.html"));
});

/* ================= START ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 SERVER RUNNING ON", PORT);
});
