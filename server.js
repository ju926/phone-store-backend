const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */
const MONGO_URI = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "phone_store_secret_key";

/* ================= DB ================= */
mongoose.connect(MONGO_URI)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= MODELS ================= */
const Admin = mongoose.model("Admin",{
email:String,
password:String,
role:{type:String,default:"admin"}
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

/* ================= ADMIN LOGIN ================= */
app.post("/admin-login", async (req,res)=>{

const {email,password} = req.body;

const admin = await Admin.findOne({email});
if(!admin) return res.status(400).json({error:"Invalid credentials"});

const match = await bcrypt.compare(password,admin.password);
if(!match) return res.status(400).json({error:"Invalid credentials"});

const token = jwt.sign(
{ id:admin._id, role:admin.role },
JWT_SECRET,
{ expiresIn:"24h" }
);

res.json({token});
});

/* ================= ADMIN MIDDLEWARE ================= */
function verifyAdmin(req,res,next){

const auth = req.headers.authorization;
if(!auth) return res.status(401).json({error:"No token"});

try{
const token = auth.split(" ")[1];
const decoded = jwt.verify(token,JWT_SECRET);

if(decoded.role !== "admin"){
return res.status(403).json({error:"Forbidden"});
}

req.admin = decoded;
next();

}catch(err){
res.status(401).json({error:"Invalid token"});
}

}

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ADD PRODUCT */
app.post("/products", verifyAdmin, async (req,res)=>{

const product = new Product(req.body);
await product.save();

res.json({message:"Product added ✔"});
});

/* UPDATE PRODUCT (NAME + PRICE FIXED) */
app.put("/product/:id", verifyAdmin, async (req,res)=>{

await Product.findByIdAndUpdate(req.params.id,{
$set:{
name:req.body.name,
price:req.body.price
}
});

res.json({message:"Updated ✔"});
});

/* DELETE PRODUCT */
app.delete("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= ORDERS ================= */
app.get("/orders", verifyAdmin, async (req,res)=>{
res.json(await Order.find());
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on",PORT);
});
