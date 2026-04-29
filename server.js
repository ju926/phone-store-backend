require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const axios = require("axios");

/* ================= CLOUDINARY ================= */
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= MODELS ================= */
const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String
});

const Order = mongoose.model("Order",{
fullName:String,
phone:String,
email:String,
location:String,
items:Array,
total:Number,
status:{type:String,default:"Pending"},
paymentMethod:String,
transactionCode:String,
date:{type:Date,default:Date.now}
});

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:process.env.GMAIL_USER,
pass:process.env.GMAIL_PASS
}
});

/* ================= CLOUDINARY CONFIG ================= */
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
cloudinary: cloudinary,
params: {
folder: "phone-store",
allowed_formats: ["jpg","jpeg","png","webp"]
}
});

const upload = multer({ storage });

/* ================= TEST ================= */
app.get("/ping",(req,res)=>{
res.send("Server OK ✔");
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ================= ADD PRODUCT (CLOUDINARY) ================= */
app.post("/products", upload.single("image"), async (req,res)=>{

try{

const product = new Product({
name: req.body.name,
price: req.body.price,
image: req.file.path   // 🔥 Cloudinary URL
});

await product.save();

res.json({message:"Product added ✔"});

}catch(err){
console.log(err);
res.status(500).json({error:"Upload failed"});
}

});

/* ================= UPDATE PRODUCT ================= */
app.put("/product/:id", async (req,res)=>{
const p = await Product.findById(req.params.id);
p.price = req.body.price;
await p.save();
res.json({message:"Updated ✔"});
});

/* ================= DELETE PRODUCT ================= */
app.delete("/product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

app.post("/order", async (req,res)=>{
const order = new Order(req.body);
await order.save();

await transporter.sendMail({
from:"Store <"+process.env.GMAIL_USER+">",
to:order.email,
subject:"🧾 Order Received",
html:`<h2>Order Received</h2><p>Total: KES ${order.total}</p>`
});

res.json({message:"Order placed ✔"});
});

/* ================= UPDATE ORDER STATUS ================= */
app.put("/update-order-status/:id", async (req,res)=>{
const order = await Order.findById(req.params.id);
order.status = req.body.status;
await order.save();

await transporter.sendMail({
from:"Store <"+process.env.GMAIL_USER+">",
to:order.email,
subject:"📦 Order Update",
html:`<h2>Status: ${order.status}</h2>`
});

res.json({message:"Updated ✔"});
});

/* ================= PESAPAL PAYMENT ================= */
app.post("/pesapal/pay", async (req,res)=>{

try{

console.log("PAYMENT REQUEST:", req.body);

/* TOKEN */
const tokenRes = await axios.post(
"https://pay.pesapal.com/v3/api/Auth/RequestToken",
{
consumer_key: process.env.PESAPAL_CONSUMER_KEY,
consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
}
);

const token = tokenRes.data.token;

/* PAYMENT */
const payment = {
id: Date.now().toString(),
currency: "KES",
amount: Number(req.body.total),
description: "Phone Store Purchase",
callback_url: process.env.CALLBACK_URL,

billing_address:{
email_address: req.body.email,
phone_number: req.body.phone,
first_name: req.body.name
}
};

const response = await axios.post(
"https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest",
payment,
{
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
}
}
);

/* REDIRECT FIX */
const redirect =
response.data?.redirect_url ||
response.data?.data?.redirect_url ||
response.data?.payment_url ||
null;

if(!redirect){
return res.json({
error:"No redirect URL from Pesapal",
raw: response.data
});
}

res.json({ redirect_url: redirect });

}catch(err){

console.log("ERROR:", err.response?.data || err.message);

res.status(500).json({
error:"Payment failed",
details: err.response?.data || err.message
});

}

});

/* ================= CALLBACK ================= */
app.get("/callback",(req,res)=>{
console.log("CALLBACK:", req.query);
res.send("Payment received ✔");
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
