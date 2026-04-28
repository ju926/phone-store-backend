const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CLOUDINARY ================= */
cloudinary.config({
cloud_name: "driwjor64",
api_key: "767812144924935",
api_secret: "F60T1ktvNpmGF4OOf8i9U-jJ2p0"
});

const storage = new CloudinaryStorage({
cloudinary,
params:{
folder:"store",
allowed_formats:["jpg","png","jpeg"]
}
});

const upload = multer({ storage });

/* ================= DB ================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"));

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"okola5775@gmail.com",
pass:"jzui tqah ngvi vmgc"
}
});

/* ================= MODELS ================= */
const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String,
stock:{type:Number,default:0}
});

const Order = mongoose.model("Order",{
fullName:String,
phone:String,
email:String,
location:String,
items:Array,
total:Number,
paymentMethod:String,
transactionCode:String,
status:{type:String,default:"Processing"},
paymentStatus:{type:String,default:"pending"},
date:{type:Date,default:Date.now}
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

app.post("/products", upload.single("image"), async (req,res)=>{
const p = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path,
stock:req.body.stock || 0
});
await p.save();
res.json({message:"Product added ✔"});
});

app.put("/product/:id", async (req,res)=>{
await Product.findByIdAndUpdate(req.params.id,req.body);
res.json({message:"Updated ✔"});
});

app.delete("/product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= ORDER ================= */
app.post("/order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

/* EMAIL: PROCESSING */
await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:"Order Received",

html:`
<h2>Order Processing</h2>
<p>Name: ${order.fullName}</p>
<p>Status: Processing</p>
<p>Transaction: ${order.transactionCode}</p>
`
});

res.json({message:"Order placed ✔"});
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= STATUS UPDATE ================= */
app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);
order.status = req.body.status;
await order.save();

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`Order ${order.status}`,

html:`
<h2>Order Update</h2>
<p>Status: ${order.status}</p>
<p>Transaction: ${order.transactionCode}</p>
`
});

res.json({message:"Status updated ✔"});
});

/* ================= DELETE ORDER ================= */
app.delete("/order/:id", async (req,res)=>{
await Order.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= SERVER ================= */
app.listen(10000,()=>{
console.log("Server running ✔");
});
