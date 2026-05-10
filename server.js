const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("✔ Mongo Connected"))
.catch(err=>console.log(err));

/* ================= MODELS ================= */

const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String
});

const Order = mongoose.model("Order",{
orderId:String,
phone:String,
email:String,
items:Array,
total:Number,
status:{
type:String,
default:"Pending"
},
date:{
type:Date,
default:Date.now
}
});

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:process.env.EMAIL_USER,
pass:process.env.EMAIL_PASS
}
});

/* ================= ADMIN ================= */

const ADMIN_TOKEN = "ADMIN_TOKEN_123";

function verify(req,res,next){

if(
req.headers.authorization ===
"Bearer " + ADMIN_TOKEN
){
return next();
}

return res.status(403).json({
error:"Unauthorized"
});

}

app.post("/admin-login",(req,res)=>{

const {email,password} = req.body;

if(
email === process.env.ADMIN_EMAIL &&
password === process.env.ADMIN_PASSWORD
){
return res.json({
token:ADMIN_TOKEN
});
}

res.status(401).json({
error:"Login failed"
});

});

/* ================= PRODUCTS ================= */

app.get("/products",async(req,res)=>{
res.json(await Product.find());
});

app.post("/products",verify,async(req,res)=>{

const product = await Product.create(req.body);

res.json(product);

});

app.put("/product/:id",verify,async(req,res)=>{

await Product.findByIdAndUpdate(
req.params.id,
req.body
);

res.json({success:true});

});

app.delete("/product/:id",verify,async(req,res)=>{

await Product.findByIdAndDelete(
req.params.id
);

res.json({success:true});

});

/* ================= ORDERS ================= */

app.get("/orders",verify,async(req,res)=>{

const orders = await Order.find()
.sort({date:-1});

res.json(orders);

});

app.put("/order/:id/paid",verify,async(req,res)=>{

await Order.findByIdAndUpdate(
req.params.id,
{status:"Paid"}
);

res.json({success:true});

});

/* ================= PAYMENT ================= */

app.post("/sasapay/pay", async (req,res)=>{

try{

const {
phone,
email,
total,
items
} = req.body;

/* TOKEN */

const credentials = Buffer.from(
`${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
).toString("base64");

const tokenRes = await axios.get(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{
headers:{
Authorization:`Basic ${credentials}`
}
}
);

const token =
tokenRes.data.access_token;

/* ORDER */

const orderId =
"ORDER_" + Date.now();

await Order.create({
orderId,
phone,
email,
items,
total,
status:"Pending"
});

/* PAYMENT */

const paymentRes = await axios.post(
"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
{
MerchantCode:
process.env.SASAPAY_MERCHANT_CODE,

NetworkCode:"63902",

PhoneNumber:phone,

TransactionReference:orderId,

AccountReference:orderId,

Currency:"KES",

Amount:total,

TransactionDesc:"Phone Store Payment",

CallBackURL:
"https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
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
data:paymentRes.data
});

}catch(err){

console.log(err.response?.data || err.message);

res.status(500).json({
success:false,
error:err.response?.data || err.message
});

}

});

/* ================= CALLBACK ================= */

app.post("/sasapay/callback",async(req,res)=>{

try{

const orderId =
req.body?.TransactionReference ||
req.body?.transaction_reference;

const status =
req.body?.status;

/* SUCCESS */

if(status === "Success"){

const order =
await Order.findOneAndUpdate(
{orderId},
{status:"Paid"},
{new:true}
);

/* SEND EMAIL */

if(order?.email){

await transporter.sendMail({

from:process.env.EMAIL_USER,

to:order.email,

subject:"Payment Successful",

text:`
Hello,

Your payment of KES ${order.total}
was successful.

Thank you for shopping with us.
`

});

}

}else{

await Order.findOneAndUpdate(
{orderId},
{status:"Failed"}
);

}

res.sendStatus(200);

}catch(err){

console.log(err);

res.sendStatus(500);

}

});

/* ================= STATUS ================= */

app.get("/order-status",async(req,res)=>{

const order = await Order.findOne({
orderId:req.query.orderId
});

if(!order){
return res.json({
status:"NotFound"
});
}

res.json({
status:order.status
});

});

/* ================= AUTO FAIL ================= */

setInterval(async()=>{

await Order.updateMany(
{
status:"Pending",
date:{
$lt:new Date(Date.now()-10000)
}
},
{
status:"Failed"
}
);

},5000);

/* ================= START ================= */

const PORT =
process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server Running");
});
