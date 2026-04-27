const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

/* ================= DB ================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
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
status:{type:String, default:"Pending"},
date:{type:Date, default:Date.now}
});

/* ================= MULTER ================= */
const storage = multer.diskStorage({
destination:(req,file,cb)=>cb(null,"uploads/"),
filename:(req,file,cb)=>cb(null, Date.now()+path.extname(file.originalname))
});

const upload = multer({storage});

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"YOUR_GMAIL@gmail.com",
pass:"YOUR_16_DIGIT_APP_PASSWORD"
}
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

app.post("/add-product-upload", upload.single("image"), async (req,res)=>{
const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.filename
});
await product.save();
res.json(product);
});

app.put("/update-product/:id", async (req,res)=>{
await Product.findByIdAndUpdate(req.params.id,{
name:req.body.name,
price:req.body.price
});
res.json({message:"Updated"});
});

app.delete("/delete-product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted"});
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* PLACE ORDER */
app.post("/order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

/* EMAIL */
await transporter.sendMail({
from:"Malone Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:"🛒 Order Received",
html:`<h2>Thanks ${order.fullName}</h2><p>Status: ${order.status}</p>`
});

res.json({message:"Order placed"});
});

/* UPDATE STATUS + EMAIL */
app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);

order.status = req.body.status;
await order.save();

/* EMAIL UPDATE */
await transporter.sendMail({
from:"Malone Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`📦 Order Update: ${order.status}`,
html:`
<h2>Order Update</h2>
<p><b>Name:</b> ${order.fullName}</p>
<p><b>Status:</b> ${order.status}</p>
`
});

res.json({message:"Status updated + email sent"});
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT,()=>console.log("Server running " + PORT));
