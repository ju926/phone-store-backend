const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer"); // kept but not used now
const axios = require("axios");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI)
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

/* ================= TEST ================= */
app.get("/",(req,res)=>{
res.send("Server Running ✔");
});

app.get("/ping",(req,res)=>{
res.json({ok:true});
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ================= ADD PRODUCT ================= */
app.post("/products", upload.single("image"), async (req,res)=>{

try{

if(!req.file){
return res.status(400).json({error:"No image uploaded"});
}

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path
});

await product.save();

res.json({message:"Product added ✔"});

}catch(err){
console.log(err);
res.status(500).json({error:"Upload failed"});
}

});

/* ================= GET ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= 🔥 FIXED PAY NOW ================= */
app.post("/order/pay", async (req, res) => {

  try {

    console.log("🟢 Incoming request to /order/pay");

    const { name, email, phone, items, total } = req.body;

    console.log("📦 DATA:", req.body);

    if (!name || !email || !phone || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing order data"
      });
    }

    const order = new Order({
      fullName: name,
      phone,
      email,
      location: "Online Checkout",
      items,
      total,
      paymentMethod: "PayNow",
      status: "Pending"
    });

    await order.save();

    console.log("✅ Order saved to DB");

    /* EMAIL DISABLED (TO PREVENT CRASH) */
    console.log("📧 Email skipped (debug mode)");

    return res.json({
      success: true,
      message: "Order received ✔"
    });

  } catch (err) {

    console.log("❌ ERROR IN /order/pay:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on port", PORT);
});
