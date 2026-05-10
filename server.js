const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const axios = require("axios");
const path = require("path");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors({
origin: "*",
methods: ["GET","POST","PUT","DELETE"],
allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(express.json());

/* ================= STATIC FILES ================= */
app.use(express.static(__dirname));

/* ================= HEALTH ================= */
app.get("/", (req,res)=>{
res.send("🚀 MALONE SERVER RUNNING");
});

/* ================= ENV ================= */
const MONGO_URI = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "malone_admin_secret";

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
orderId:String,
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
folder:"malone-store",
allowed_formats:["jpg","jpeg","png","webp"]
}
});

const upload = multer({ storage });

/* ================= ADMIN LOGIN ================= */
app.post("/admin-login", async (req,res)=>{
try{

const {email,password} = req.body;

const admin = await Admin.findOne({email});
if(!admin) return res.status(400).json({error:"Invalid login"});

const match = await bcrypt.compare(password,admin.password);
if(!match) return res.status(400).json({error:"Invalid login"});

const token = jwt.sign(
{id:admin._id,role:admin.role},
JWT_SECRET,
{expiresIn:"24h"}
);

res.json({token});

}catch(err){
res.status(500).json({error:"Server error"});
}
});

/* ================= AUTH ================= */
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
res.json(await Product.find().sort({_id:-1}));
});

/* UPLOAD PRODUCT */
app.post("/products", verifyAdmin, upload.single("image"), async (req,res)=>{

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

res.json({success:true,message:"Product uploaded ✔"});

}catch(err){
res.status(500).json({error:"Upload failed"});
}

});

/* UPDATE PRODUCT */
app.put("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndUpdate(req.params.id,{
name:req.body.name,
price:req.body.price
});
res.json({message:"Updated ✔"});
});

/* DELETE PRODUCT */
app.delete("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= ORDERS ================= */
app.post("/order/pay", async (req,res)=>{

try{

const {items,total,user} = req.body;

const order = await Order.create({
orderId:"ORDER_"+Date.now(),
userId:user?.id || "guest",
fullName:user?.name || "Guest",
email:user?.email || "",
phone:user?.phone || "",
address:user?.address || "",
items,
total,
status:"Pending"
});

res.json({
success:true,
message:"Order saved ✔",
orderId:order.orderId
});

}catch(err){
res.status(500).json({error:"Order failed"});
}

});

/* ================= SASAPAY PAYMENT ================= */
app.post("/sasapay/pay", async (req,res)=>{

try{

const {items,total,phone} = req.body;

/* 1. GET TOKEN */
const tokenRes = await axios.post(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{},
{
auth:{
username: process.env.SASAPAY_CLIENT_ID,
password: process.env.SASAPAY_CLIENT_SECRET
}
}
);

const token = tokenRes.data.access_token;

/* 2. ORDER ID */
const orderId = "ORDER_" + Date.now();

/* 3. PAYMENT REQUEST */
const response = await axios.post(
"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
{
MerchantCode: process.env.SASAPAY_MERCHANT_CODE,
PhoneNumber: phone,
Amount: total,
Currency: "KES",
TransactionReference: orderId,
CallBackURL: "https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
},
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

/* 4. SAVE ORDER */
await Order.create({
orderId,
items,
total,
phone,
status:"Pending"
});

res.json({
success:true,
message:"Payment initiated ✔",
data:response.data
});

}catch(err){

console.log("SASAPAY ERROR:", err.response?.data || err.message);

res.status(500).json({
error:"Payment failed"
});

}

});

/* ================= SASAPAY CALLBACK ================= */
app.post("/sasapay/callback", async (req,res)=>{

try{

console.log("SasaPay Callback:", req.body);

const status = req.body?.status;
const orderId = req.body?.TransactionReference;

/* SUCCESS */
if(status === "Success"){

await Order.findOneAndUpdate(
{orderId},
{status:"Paid"}
);

return res.redirect(
`/confirm.html?orderId=${orderId}`
);

}

/* FAILED */
await Order.findOneAndUpdate(
{orderId},
{status:"Failed"}
);

return res.redirect("/failed.html");

}catch(err){

console.log("Callback error:", err.message);

return res.redirect("/failed.html");

}

});

/* ================= HTML ROUTES ================= */
app.get("/confirm.html", (req,res)=>{
res.sendFile(path.join(__dirname,"confirm.html"));
});

app.get("/failed.html", (req,res)=>{
res.sendFile(path.join(__dirname,"failed.html"));
});

/* ================= ORDERS ================= */
app.get("/orders", verifyAdmin, async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 MALONE SERVER RUNNING ON PORT", PORT);
});
