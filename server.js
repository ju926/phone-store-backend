require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("✔ MongoDB Connected"))
.catch(err => console.log(err));

/* ================= CLOUDINARY ================= */
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
cloudinary,
params: {
folder: "products",
allowed_formats: ["jpg", "png", "jpeg", "webp"]
}
});

const upload = multer({ storage });

/* ================= MODELS ================= */
const Product = mongoose.model("Product", {
name: String,
price: Number,
image: String,
imageUrl: String,
photo: String,
date: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", {
orderId: { type: String, unique: true },
phone: String,
email: String,
items: Array,
total: Number,
status: { type: String, default: "pending" },
date: { type: Date, default: Date.now }
});

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}
});

/* ================= ADMIN ================= */
const ADMIN_TOKEN = "ADMIN_TOKEN_123";

function verify(req,res,next){
if(req.headers.authorization === "Bearer " + ADMIN_TOKEN){
return next();
}
return res.status(403).json({error:"Unauthorized"});
}

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
const products = await Product.find();

res.json(products.map(p=>({
_id:p._id,
name:p.name,
price:p.price,
image:p.image || p.imageUrl || p.photo || ""
})));
});

app.post("/products", verify, upload.single("image"), async (req,res)=>{
const product = await Product.create({
name:req.body.name,
price:req.body.price,
image:req.file.path,
imageUrl:req.file.path,
photo:req.file.path
});
res.json(product);
});

/* ================= SASAPAY PAYMENT ================= */
app.post("/sasapay/pay", async (req,res)=>{
try{

const {phone,email,total,items} = req.body;

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

const orderId = "ORDER_" + Date.now();

/* CREATE ORDER */
await Order.create({
orderId,
phone,
email,
items,
total,
status:"pending"
});

/* SEND PAYMENT REQUEST */
const paymentRes = await axios.post(
"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
{
MerchantCode:process.env.SASAPAY_MERCHANT_CODE,
NetworkCode:"63902",
PhoneNumber:phone,
TransactionReference:orderId,
AccountReference:orderId,
Currency:"KES",
Amount:total,
TransactionDesc:"Store Payment",
CallBackURL:process.env.CALLBACK_URL
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
checkoutRequestID: paymentRes.data?.CheckoutRequestID || null
});

}catch(err){
console.log(err.response?.data || err.message);

res.status(500).json({
success:false,
error:"Payment request failed"
});
}
});

/* ================= CALLBACK (FIXED + SAFE) ================= */
app.post("/sasapay/callback", async (req,res)=>{
try{

const data = req.body;

const orderId =
data?.TransactionReference ||
data?.transaction_reference ||
data?.transactionReference ||
data?.OrderID;

/* SAFETY CHECK */
if(!orderId){
return res.sendStatus(200);
}

let statusRaw =
data?.status ||
data?.Status ||
data?.ResultDesc ||
data?.ResultCode;

statusRaw = (statusRaw || "").toString().toLowerCase();

/* SUCCESS DETECTION */
const isSuccess =
statusRaw.includes("success") ||
statusRaw.includes("completed") ||
statusRaw === "0";

/* UPDATE ORDER ONCE ONLY */
const order = await Order.findOne({orderId});

if(!order){
return res.sendStatus(200);
}

/* prevent double overwrite */
if(order.status === "success" || order.status === "failed"){
return res.sendStatus(200);
}

if(isSuccess){

order.status = "success";
await order.save();

if(order.email){
await transporter.sendMail({
from:process.env.EMAIL_USER,
to:order.email,
subject:"Payment Successful ✔",
html:`<h2>Payment Successful</h2><p>Order ${orderId} paid successfully.</p>`
});
}

}else{

order.status = "failed";
await order.save();

if(order.email){
await transporter.sendMail({
from:process.env.EMAIL_USER,
to:order.email,
subject:"Payment Failed ❌",
html:`<h2>Payment Failed</h2><p>Order ${orderId} failed.</p>`
});
}

}

return res.sendStatus(200);

}catch(err){
console.log("CALLBACK ERROR:",err);
return res.sendStatus(200);
}
});

/* ================= ORDER STATUS ================= */
app.get("/order-status", async (req,res)=>{
try{

const order = await Order.findOne({orderId:req.query.orderId});

if(!order){
return res.json({status:"notfound"});
}

return res.json({
status:order.status
});

}catch(err){
return res.json({status:"error"});
}
});

/* ================= AUTO FAIL SAFETY ================= */
setInterval(async ()=>{

const timeout = new Date(Date.now() - 2 * 60 * 1000);

await Order.updateMany(
{
status:"pending",
date:{$lt:timeout}
},
{status:"failed"}
);

},15000);

/* ================= START ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on port",PORT);
});
