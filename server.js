require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* ================= FRONTEND BASE URL ================= */

const FRONTEND = "https://ju926.github.io/maloneti";

/* ================= DB ================= */

mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("✔ MongoDB Connected"))
.catch(err=>console.log(err));

/* ================= MODELS ================= */

const Order = mongoose.model("Order",{
orderId:String,
phone:String,
email:String,
items:Array,
total:Number,
status:{type:String, default:"Pending"},
date:{type:Date, default:Date.now}
});

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:process.env.EMAIL_USER,
pass:process.env.EMAIL_PASS
}
});

/* ================= PAYMENT ================= */

app.post("/sasapay/pay", async (req,res)=>{

try{

const {phone,email,total,items} = req.body;

/* TOKEN */

const credentials = Buffer.from(
`${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
).toString("base64");

const tokenRes = await axios.get(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{
headers:{ Authorization:`Basic ${credentials}` }
}
);

const token = tokenRes.data.access_token;

/* ORDER */

const orderId = "ORDER_" + Date.now();

await Order.create({
orderId, phone, email, items, total, status:"Pending"
});

/* PAYMENT REQUEST */

const payment = await axios.post(
"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
{
MerchantCode:process.env.SASAPAY_MERCHANT_CODE,
NetworkCode:"63902",
PhoneNumber:phone,
TransactionReference:orderId,
AccountReference:orderId,
Currency:"KES",
Amount:total,
TransactionDesc:"Purchase",
CallBackURL: process.env.CALLBACK_URL
},
{
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
}
}
);

res.json({
success:true,
orderId,
data:payment.data
});

}catch(err){

res.status(500).json({
success:false,
error:err.response?.data || err.message
});

}

});

/* ================= CALLBACK ================= */

app.post("/sasapay/callback", async (req,res)=>{

try{

const orderId =
req.body?.TransactionReference ||
req.body?.transaction_reference;

const status = req.body?.status;

let order;

if(status === "Success"){

order = await Order.findOneAndUpdate(
{orderId},
{status:"Paid"},
{new:true}
);

/* EMAIL SUCCESS */

if(order?.email){

await transporter.sendMail({
from:process.env.EMAIL_USER,
to:order.email,
subject:"Payment Successful ✔",
html:`
<h2>Payment Successful</h2>
<p>Amount: KES ${order.total}</p>
<p>Thank you for shopping with us.</p>
`
});

}

return res.redirect(FRONTEND + "/confirm.html?orderId=" + orderId);

}

/* FAILED */

order = await Order.findOneAndUpdate(
{orderId},
{status:"Failed"},
{new:true}
);

/* EMAIL FAILED */

if(order?.email){

await transporter.sendMail({
from:process.env.EMAIL_USER,
to:order.email,
subject:"Payment Failed ❌",
html:`
<h2>Payment Failed</h2>
<p>Your payment of KES ${order.total} failed or was cancelled.</p>
`
});

}

return res.redirect(FRONTEND + "/failed.html");

}catch(err){

return res.redirect(FRONTEND + "/failed.html");

}

});

/* ================= STATUS CHECK ================= */

app.get("/order-status", async (req,res)=>{

const order = await Order.findOne({orderId:req.query.orderId});

if(!order){
return res.json({status:"NotFound"});
}

res.json({status:order.status});

});

/* ================= AUTO FAIL (10 sec) ================= */

setInterval(async ()=>{

await Order.updateMany(
{
status:"Pending",
date:{ $lt:new Date(Date.now()-10000) }
},
{status:"Failed"}
);

},5000);

/* ================= START ================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on", PORT);
});
