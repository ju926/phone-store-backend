const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= ENV SAFE CHECK ================= */
const MONGO_URI = process.env.MONGO_URL;
const JWT_SECRET = "phone_store_secret_key";

/* ================= DB (FIXED SAFE CONNECT) ================= */
if (!MONGO_URI) {
console.error("❌ MONGO_URL is missing in environment variables");
} else {
mongoose.connect(MONGO_URI)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("DB ERROR:", err));
}

/* ================= MODELS ================= */
const User = mongoose.model("User",{
name:String,
email:String,
password:String,
phone:String,
address:String,
idNumber:String,
deliveryType:String
});

const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String
});

const Order = mongoose.model("Order",{
userId:String,
fullName:String,
email:String,
phone:String,
address:String,
items:Array,
total:Number,
status:{type:String,default:"Pending"},
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

/* ================= AUTH ================= */

/* REGISTER */
app.post("/register", async (req,res)=>{

const {name,email,password} = req.body;

const exist = await User.findOne({email});
if(exist) return res.status(400).json({error:"User exists"});

const hash = await bcrypt.hash(password,10);

const user = new User({name,email,password:hash});
await user.save();

res.json({message:"Account created ✔"});
});

/* LOGIN */
app.post("/login", async (req,res)=>{

const {email,password} = req.body;

const user = await User.findOne({email});
if(!user) return res.status(400).json({error:"User not found"});

const match = await bcrypt.compare(password,user.password);
if(!match) return res.status(400).json({error:"Wrong password"});

const token = jwt.sign(
{id:user._id,email:user.email},
JWT_SECRET,
{expiresIn:"7d"}
);

res.json({
token,
user:{
id:user._id,
name:user.name,
email:user.email
}
});

});

/* ================= AUTH MIDDLEWARE ================= */
function auth(req,res,next){

const header = req.headers.authorization;

if(!header) return res.status(401).json({error:"No token"});

try{
const token = header.split(" ")[1];
const decoded = jwt.verify(token,JWT_SECRET);
req.user = decoded;
next();
}catch(err){
res.status(401).json({error:"Invalid token"});
}

}

/* ================= CURRENT USER ================= */
app.get("/me", auth, async (req,res)=>{

const user = await User.findById(req.user.id).select("-password");
res.json(user);

});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

app.post("/products", upload.single("image"), async (req,res)=>{

if(!req.file){
return res.status(400).json({error:"No image"});
}

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path
});

await product.save();

res.json({message:"Product added ✔"});
});

/* ================= ORDERS ================= */

/* CREATE ORDER */
app.post("/order/pay", auth, async (req,res)=>{

try{

const {items,total} = req.body;

const user = await User.findById(req.user.id);

const order = new Order({
userId:user._id,
fullName:user.name,
email:user.email,
phone:user.phone,
address:user.address,
items,
total,
status:"Pending"
});

await order.save();

console.log("📦 Order placed for:", user.email);

res.json({success:true,message:"Order placed ✔"});

}catch(err){
console.log("ORDER ERROR:", err);
res.status(500).json({error:"Server error"});
}

});

/* ================= PAYSTACK / PESAPAL INTEGRATION SAFE ================= */
app.post("/payments/pesapal/initiate", async (req,res)=>{

try{

const axios = require("axios");

const response = await axios.post(
"https://pay.makamesco-tech.co.ke/api/payments/pesapal/initiate",
req.body,
{
headers:{
"X-API-Key": process.env.MPESA_SECRET_KEY || "",
"Content-Type":"application/json"
}
}
);

res.json(response.data);

}catch(err){
console.log("PAYMENT ERROR:", err.response?.data || err.message);
res.status(500).json({error:"Payment failed"});
}

});

/* ================= PAYMENT STATUS ================= */
app.get("/payments/status/:id", async (req,res)=>{

try{

const axios = require("axios");

const response = await axios.get(
`https://pay.makamesco-tech.co.ke/api/payments/pesapal/status/${req.params.id}`,
{
headers:{
"X-API-Key": process.env.MPESA_SECRET_KEY || ""
}
}
);

res.json(response.data);

}catch(err){
res.status(500).json({error:"Status check failed"});
}

});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on port", PORT);
});
