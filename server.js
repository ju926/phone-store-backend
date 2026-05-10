const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const app = express();

app.use(cors({ origin:"*" }));
app.use(express.json());
app.use(express.static(__dirname));

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

const Order = mongoose.model("Order",{
orderId:String,
phone:String,
items:Array,
total:Number,
status:{type:String,default:"Pending"},
date:{type:Date,default:Date.now}
});

/* ================= HEALTH ================= */
app.get("/",(req,res)=>{
res.send("🚀 SERVER RUNNING");
});

/* ================= SASAPAY PAYMENT ================= */
app.post("/sasapay/pay", async (req,res)=>{

try{

const {phone,total,items} = req.body;

console.log("PAY REQUEST:", {phone,total});

/* CHECK ENV */
console.log("ENV:", {
client: process.env.SASAPAY_CLIENT_ID ? "OK" : "MISSING",
secret: process.env.SASAPAY_CLIENT_SECRET ? "OK" : "MISSING",
merchant: process.env.SASAPAY_MERCHANT_CODE
});

/* ================= TOKEN ================= */
const tokenRes = await axios({
method:"POST",
url:"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
auth:{
username: process.env.SASAPAY_CLIENT_ID,
password: process.env.SASAPAY_CLIENT_SECRET
},
headers:{
"Content-Type":"application/json"
}
});

console.log("TOKEN RESPONSE:", tokenRes.data);

const token = tokenRes.data.access_token;

if(!token){
throw new Error("Token not received");
}

/* ================= ORDER ================= */
const orderId = "ORDER_" + Date.now();

/* ================= PAYMENT REQUEST ================= */
const payment = await axios({
method:"POST",
url:"https://sandbox.sasapay.app/api/v1/payments/payments/",
data:{
MerchantCode: process.env.SASAPAY_MERCHANT_CODE,
PhoneNumber: phone,
Amount: total,
Currency: "KES",
TransactionReference: orderId,
CallBackURL: "https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
},
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
}
});

console.log("PAYMENT RESPONSE:", payment.data);

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

console.log("🔥 SASAPAY ERROR:");
console.log(err.response?.data || err.message);

res.status(500).json({
error:"Payment failed",
details:err.response?.data || err.message
});

}

});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req,res)=>{

try{

console.log("CALLBACK:", req.body);

const status = req.body?.status;
const orderId = req.body?.TransactionReference;

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
