const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= MODELS ================= */
const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String
});

const Order = mongoose.model("Order",{
items:Array,
total:Number,
status:{type:String,default:"Pending"},
paymentStatus:{type:String,default:"Pending"},
orderTrackingId:String,
date:{type:Date,default:Date.now}
});

/* ================= PESAPAL TOKEN ================= */
async function getToken(){

const res = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Auth/RequestToken`,
{
consumer_key:process.env.PESAPAL_CONSUMER_KEY,
consumer_secret:process.env.PESAPAL_CONSUMER_SECRET
}
);

return res.data.token;
}

/* ================= PAY ================= */
app.post("/pesapal/pay", async (req,res)=>{

try{

console.log("PAY REQUEST:", req.body);

const {amount,items} = req.body;

const token = await getToken();

const orderId = "ORDER_"+Date.now();

/* SAVE ORDER */
await Order.create({
items,
total:amount,
orderTrackingId:orderId
});

const response = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
{
id:orderId,
currency:"KES",
amount,
description:"Phone Store",
callback_url:"https://yourdomain.com/confirm.html",
notification_id:process.env.PESAPAL_IPN_ID,
billing_address:{
email_address:"customer@email.com",
phone_number:"0700000000",
country_code:"KE",
first_name:"Customer"
}
},
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

console.log("PESAPAL RESPONSE:", response.data);

res.json(response.data);

}catch(err){
console.log("PAY ERROR:", err.response?.data || err.message);
res.status(500).json({error:"Payment failed"});
}

});

/* ================= STATUS ================= */
app.get("/pesapal/status/:id", async (req,res)=>{

try{

const token = await getToken();

const response = await axios.get(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${req.params.id}`,
{
headers:{Authorization:`Bearer ${token}`}
}
);

if(response.data.payment_status === "COMPLETED"){
await Order.findOneAndUpdate(
{orderTrackingId:req.params.id},
{paymentStatus:"Paid",status:"Processing"}
);
}

res.json(response.data);

}catch(err){
res.status(500).json({error:"Status failed"});
}

});

/* ================= SERVER ================= */
app.listen(10000,()=>{
console.log("🚀 Server running");
});
