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

/* ================= ENV ================= */
const MONGO_URI = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "super_secure_secret_change_this";

/* ================= DB ================= */
mongoose.connect(MONGO_URI)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("DB ERROR:", err));

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

/* ================= CLOUDINARY ================= */
cloudinary.config({
cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
api_key:process.env.CLOUDINARY_API_KEY,
api_secret:process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
cloudinary,
params:{
folder:"phone-store",
allowed_formats:["jpg","png","jpeg","webp"]
}
});

const upload = multer({storage});

/* ================= CREATE ADMIN (RUN ONCE) ================= */
app.get("/create-admin", async (req,res)=>{
const hash = await bcrypt.hash("Store@2026",10);

await Admin.create({
email:"admin@store.com",
password:hash
});

res.send("Admin created ✔");
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

app.post("/products", verifyAdmin, upload.single("image"), async (req,res)=>{

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

app.delete("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted"});
});

app.put("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndUpdate(req.params.id,{price:req.body.price});
res.json({message:"Updated"});
});

/* ================= ORDERS ================= */
app.get("/orders", verifyAdmin, async (req,res)=>{
res.json(await Order.find());
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on port", PORT);
});
