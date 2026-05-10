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
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

const Order = mongoose.model("Order",{
orderId:String,
phone:String,
items:Array,
total:Number,
status:{type:String,default:"Pending"},
expiresAt:Date
});

/* ================= PAY ================= */
app.post("/sasapay/pay", async (req,res)=>{

try{

const {phone,total,items} = req.body;

const credentials = Buffer.from(
`${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
).toString("base64");

const tokenRes = await axios({
method:"GET",
url:"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
headers:{
Authorization:`Basic ${credentials}`
}
});

const token = tokenRes.data.access_token;

const orderId = "ORDER_"+Date.now();

/* 10 sec expiry */
const expiresAt = new Date(Date.now()+10000);

await Order.create({
orderId,
phone,
items,
total,
status:"Pending",
expiresAt
});

const payment = await axios({
method:"POST",
url:"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
data:{
MerchantCode:process.env.SASAPAY_MERCHANT_CODE,
NetworkCode:"63902",
PhoneNumber:phone,
TransactionReference:orderId,
AccountReference:orderId,
Currency:"KES",
Amount:total,
TransactionDesc:"Checkout",
CallBackURL:"https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
},
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
}
});

return res.json({
success:true,
orderId,
data:payment.data
});

}catch(err){

return res.status(500).json({
success:false,
error:err.response?.data || err.message
});

}

});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback",async(req,res)=>{

const orderId =
req.body?.TransactionReference ||
req.body?.transaction_reference;

const status = req.body?.status;

if(status==="Success"){

await Order.findOneAndUpdate(
{orderId},
{status:"Paid"}
);

}else{

await Order.findOneAndUpdate(
{orderId},
{status:"Failed"}
);

}

res.sendStatus(200);

});

/* ================= ORDER STATUS ================= */
app.get("/order-status",async(req,res)=>{

const order = await Order.findOne({
orderId:req.query.orderId
});

if(!order){
return res.json({status:"NotFound"});
}

res.json({status:order.status});

});

/* ================= AUTO FAIL ================= */
setInterval(async()=>{

await Order.updateMany(
{
status:"Pending",
expiresAt:{$lt:new Date()}
},
{status:"Failed"}
);

},5000);

/* ================= ROUTES ================= */
app.get("/confirm.html",(req,res)=>{
res.sendFile(path.join(__dirname,"confirm.html"));
});

app.get("/failed.html",(req,res)=>{
res.sendFile(path.join(__dirname,"failed.html"));
});

/* ================= START ================= */
app.listen(10000,()=>{
console.log("Server running");
});
