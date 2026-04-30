const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const axios = require("axios");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const admin = require("firebase-admin");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

require("dotenv").config();

const app = express();

/* ================= SECURITY MIDDLEWARE ================= */
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(rateLimit({
windowMs: 15 * 60 * 1000,
max: 200
}));

/* ================= FIREBASE ADMIN (AUTH SECURITY) ================= */
admin.initializeApp({
credential: admin.credential.applicationDefault()
});

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("DB ERROR:", err));

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
userId:String,   // 🔐 IMPORTANT
location:String,
items:Array,
total:Number,
status:{type:String,default:"Pending"},
paymentMethod:String,
transactionCode:String,
date:{type:Date,default:Date.now}
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
cloudinary,
params:{
folder:"phone-store",
allowed_formats:["jpg","jpeg","png","webp"]
}
});

const upload = multer({ storage });

/* ================= AUTH MIDDLEWARE ================= */
async function verifyUser(req,res,next){

try{

const token = req.headers.authorization?.split("Bearer ")[1];

if(!token){
return res.status(401).json({error:"No token"});
}

const decoded = await admin.auth().verifyIdToken(token);

req.user = decoded;

next();

}catch(err){
return res.status(401).json({error:"Unauthorized"});
}

}

/* ================= TEST ================= */
app.get("/",(req,res)=>{
res.send("Server Running ✔");
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

app.post("/products", upload.single("image"), async (req,res)=>{

try{

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path
});

await product.save();

res.json({message:"Product added ✔"});

}catch(err){
res.status(500).json({error:"Upload failed"});
}

});

/* ================= ORDERS (SECURE CREATE) ================= */
app.post("/order/pay", verifyUser, async (req,res)=>{

try{

const { items, total, fullName, phone } = req.body;

const order = new Order({
fullName,
phone,
email:req.user.email,
userId:req.user.uid,   // 🔐 SECURE LINK
items,
total,
status:"Pending",
paymentMethod:"PayNow"
});

await order.save();

res.json({success:true});

}catch(err){
console.log(err);
res.status(500).json({error:"Order failed"});
}

});

/* ================= USER ORDERS (SECURE) ================= */
app.get("/my-orders", verifyUser, async (req,res)=>{

const orders = await Order.find({ userId: req.user.uid })
.sort({date:-1});

res.json(orders);

});

/* ================= ADMIN ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= UPDATE ORDER STATUS ================= */
app.put("/update-order-status/:id", async (req,res)=>{

await Order.findByIdAndUpdate(req.params.id,{
status:req.body.status
});

res.json({message:"Updated ✔"});

});

/* ================= DELETE ORDER ================= */
app.delete("/order/:id", async (req,res)=>{

await Order.findByIdAndDelete(req.params.id);

res.json({message:"Deleted ✔"});

});

/* ================= DELETE PRODUCT ================= */
app.delete("/product/:id", async (req,res)=>{

await Product.findByIdAndDelete(req.params.id);

res.json({message:"Product deleted ✔"});

});

/* ================= EMAIL SETUP (READY) ================= */
const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:process.env.GMAIL_USER,
pass:process.env.GMAIL_PASS
}
});

/* ================= PESAPAL READY HOOK ================= */
app.post("/pesapal-callback", async (req,res)=>{

console.log("Pesapal callback:", req.body);

res.json({status:"received"});

});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on port", PORT);
});
