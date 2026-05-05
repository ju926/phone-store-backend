const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= TEST ================= */
app.get("/", (req,res)=>{
res.send("🚀 MALONE BACKEND RUNNING");
});

/* ================= MODEL ================= */
const Order = mongoose.model("Order",{
items:Array,
total:Number,
status:{type:String,default:"Pending"},
paymentStatus:{type:String,default:"Pending"},
orderTrackingId:String,
date:{type:Date,default:Date.now}
});

/* ================= IPN ================= */
app.post("/pesapal/ipn",(req,res)=>{
console.log("📩 IPN RECEIVED:", req.body);
res.json({ok:true});
});

/* ================= TOKEN ================= */
async function getToken(){
try{

const res = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Auth/RequestToken`,
{
consumer_key: process.env.PESAPAL_CONSUMER_KEY,
consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
}
);

console.log("🔑 TOKEN OK");
return res.data.token;

}catch(err){
console.log("❌ TOKEN ERROR:", err.response?.data || err.message);
throw err;
}
}

/* ================= PAY ================= */
app.post("/pesapal/pay", async (req,res)=>{

try{

console.log("🔥 PAYMENT REQUEST:", req.body);

const {amount,items} = req.body;

const token = await getToken();

const orderId = "ORDER_" + Date.now();

/* SAVE ORDER */
await Order.create({
items,
total:amount,
orderTrackingId:orderId
});

const payload = {
id: orderId,
currency: "KES",
amount,
description: "Malone Store Purchase",
callback_url: "https://phone-store-backend-9w7p.onrender.com/confirm.html",
notification_id: process.env.PESAPAL_IPN_ID,
billing_address:{
email_address:"customer@email.com",
phone_number:"0700000000",
country_code:"KE",
first_name:"Customer"
}
};

console.log("📦 PAYLOAD:", payload);

const response = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
payload,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

console.log("📥 PESAPAL RESPONSE:", response.data);

res.json(response.data);

}catch(err){

console.log("❌ PAYMENT FAILED:");
console.log(err.response?.data || err.message);

res.status(500).json({
error:"Payment failed",
details: err.response?.data || err.message
});

}
});

/* ================= STATUS ================= */
app.get("/pesapal/status/:id", async (req,res)=>{

try{

const token = await getToken();

const response = await axios.get(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${req.params.id}`,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

res.json(response.data);

}catch(err){
console.log(err.message);
res.status(500).json({error:"Status error"});
}

});

/* ================= START ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 SERVER RUNNING ON", PORT);
});
