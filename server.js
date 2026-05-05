const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const axios = require("axios");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= ENV ================= */
const MONGO_URI = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "malone_admin_secret";

/* PESA PAL ENV */
const PESAPAL_BASE = "https://pay.pesapal.com/v3";
const PESAPAL_KEY = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_IPN_ID = process.env.PESAPAL_IPN_ID;

/* ================= DB ================= */
if (!MONGO_URI) {
  console.log("❌ MONGO_URL missing");
} else {
  mongoose.connect(MONGO_URI)
  .then(()=>console.log("MongoDB Connected ✔"))
  .catch(err=>console.log("DB ERROR:", err));
}

/* ================= MODELS ================= */
const Admin = mongoose.model("Admin", {
  email: String,
  password: String,
  role: { type: String, default: "admin" }
});

const Product = mongoose.model("Product", {
  name: String,
  price: Number,
  image: String
});

const Order = mongoose.model("Order", {
  orderId: String,
  userId: String,
  fullName: String,
  email: String,
  phone: String,
  address: String,
  items: Array,
  total: Number,
  status: { type: String, default: "Pending" },
  date: { type: Date, default: Date.now }
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "malone-store",
    allowed_formats: ["jpg", "jpeg", "png", "webp"]
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

if(decoded.role!=="admin"){
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

app.post("/products", verifyAdmin, upload.single("image"), async (req,res)=>{
try{

console.log("📥 PRODUCT UPLOAD:", req.body, req.file);

if(!req.file){
return res.status(400).json({error:"No image uploaded"});
}

const product = new Product({
name:req.body.name,
price:Number(req.body.price),
image:req.file.path
});

await product.save();

res.json({message:"Product added ✔", product});

}catch(err){
console.log(err);
res.status(500).json({error:"Upload failed"});
}
});

app.put("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndUpdate(req.params.id,{
name:req.body.name,
price:req.body.price
});
res.json({message:"Updated ✔"});
});

app.delete("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= GET TOKEN ================= */
async function getToken(){
const res = await axios.post(`${PESAPAL_BASE}/api/Auth/RequestToken`,{
consumer_key:PESAPAL_KEY,
consumer_secret:PESAPAL_SECRET
});
return res.data.token;
}

/* ================= PESA PAL PAYMENT ================= */
app.post("/pesapal/pay", async (req,res)=>{
try{

const {items,total,user} = req.body;

console.log("🔥 PESAPAL PAYMENT:", total);

const token = await getToken();

const orderId = "ORDER_" + Date.now();

const payload = {
id: orderId,
currency: "KES",
amount: total,
description: "Malone Store Purchase",
callback_url: "https://phone-store-backend-9w7p.onrender.com/confirm.html",
notification_id: PESAPAL_IPN_ID,
billing_address: {
email_address: "customer@email.com",
phone_number: "0700000000",
country_code: "KE",
first_name: "Customer"
}
};

const response = await axios.post(
`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`,
payload,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

console.log("📥 PESAPAL RESPONSE:", response.data);

/* SAVE ORDER INITIALLY */
await Order.create({
orderId,
items,
total,
status:"Pending"
});

res.json(response.data);

}catch(err){
console.log("❌ PESAPAL ERROR:", err.response?.data || err.message);
res.status(500).json({error:"Payment failed"});
}
});

/* ================= IPN ================= */
app.post("/pesapal/ipn", async (req,res)=>{
try{

console.log("🔔 IPN:", req.body);

const {orderTrackingId} = req.body;

if(!orderTrackingId){
return res.status(400).json({error:"No tracking ID"});
}

const token = await getToken();

const status = await axios.get(
`${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
{
headers:{Authorization:`Bearer ${token}`}
}
);

console.log("📊 STATUS:", status.data);

/* UPDATE ORDER */
await Order.updateOne(
{orderId:orderTrackingId},
{$set:{status:"Paid"}}
);

res.json({success:true});

}catch(err){
console.log("❌ IPN ERROR:", err.message);
res.status(500).json({error:"IPN failed"});
}
});

/* ================= ORDERS ================= */
app.get("/orders", verifyAdmin, async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= TEST ================= */
app.get("/", (req,res)=>{
res.send("🚀 MALONE SERVER RUNNING");
});

/* ================= START ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 SERVER RUNNING ON", PORT);
});
