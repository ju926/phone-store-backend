require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

/* ================= ENTERPRISE ADDITION ================= */
const http = require("http");
const { Server } = require("socket.io");

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
orderId: String,
phone: String,
email: String,
items: Array,
total: Number,
status: { type: String, default: "Pending" },
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

/* ================= ORDERS ================= */
app.get("/orders", verify, async (req,res)=>{
const orders = await Order.find().sort({date:-1});
res.json(orders);
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

await Order.create({
orderId,
phone,
email,
items,
total,
status:"Pending"
});

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
checkoutRequestID: paymentRes.data?.CheckoutRequestID || orderId
});

}catch(err){
console.log(err.response?.data || err.message);
res.status(500).json({
success:false,
error:err.message
});
}
});

/* ================= SOCKET (ENTERPRISE LIVE TRACKING) ================= */
const server = http.createServer(app);

const io = new Server(server, {
cors: { origin: "*" }
});

io.on("connection", (socket) => {
console.log("Client connected:", socket.id);

socket.on("trackOrder", (orderId) => {
socket.join(orderId);
});
});

/* ================= CALLBACK (REAL-TIME FIXED) ================= */
app.post("/sasapay/callback", async (req,res)=>{
try{

console.log("CALLBACK:",req.body);

const orderId =
req.body?.TransactionReference ||
req.body?.transactionReference ||
req.body?.transaction_reference ||
req.body?.OrderID;

const statusRaw =
req.body?.status ||
req.body?.Status ||
req.body?.ResultCode;

let status = (statusRaw || "").toString().toLowerCase();

/* ================= SUCCESS ================= */
if(
status.includes("success") ||
status.includes("0") ||
status.includes("completed")
){

await Order.findOneAndUpdate(
{orderId},
{status:"Paid"},
{new:true}
);

/* LIVE PUSH */
io.to(orderId).emit("statusUpdate", {
status:"Paid",
orderId
});

return res.sendStatus(200);
}

/* ================= FAILED ================= */
await Order.findOneAndUpdate(
{orderId},
{status:"Failed"}
);

io.to(orderId).emit("statusUpdate", {
status:"Failed",
orderId
});

return res.sendStatus(200);

}catch(err){
console.log("CALLBACK ERROR:",err);
return res.sendStatus(500);
}
});

/* ================= ORDER STATUS API ================= */
app.get("/order-status", async (req,res)=>{
try{

const order = await Order.findOne({orderId:req.query.orderId});

if(!order){
return res.json({status:"notfound"});
}

let status = order.status;

if(status === "Paid") status = "success";
if(status === "Pending") status = "pending";
if(status === "Failed") status = "failed";

res.json({
status,
orderId: order.orderId
});

}catch(err){
res.json({status:"error"});
}
});

/* ================= AUTO FAIL (SAFE) ================= */
setInterval(async ()=>{

const timeout = new Date(Date.now() - 10 * 60 * 1000);

await Order.updateMany(
{
status:"Pending",
date:{$lt:timeout}
},
{status:"Failed"}
);

},30000);

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;

server.listen(PORT,()=>{
console.log("🚀 Enterprise server running on port",PORT);
});
