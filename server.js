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

/* ================= DB ================= */
if (!MONGO_URI) {
  console.log("❌ MONGO_URL missing");
} else {
  mongoose.connect(MONGO_URI)
    .then(()=>console.log("MongoDB Connected ✔"))
    .catch(err=>console.log("DB ERROR:", err));
}

/* ================= MODELS ================= */

/* ADMIN */
const Admin = mongoose.model("Admin", {
  email: String,
  password: String,
  role: { type: String, default: "admin" }
});

/* PRODUCT */
const Product = mongoose.model("Product", {
  name: String,
  price: Number,
  image: String
});

/* ORDER */
const Order = mongoose.model("Order", {
  userId: String,
  fullName: String,
  email: String,
  phone: String,
  address: String,
  items: Array,
  total: Number,
  status: { type: String, default: "Pending" },
  paymentStatus: { type: String, default: "Pending" },
  orderTrackingId: String,
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
    allowed_formats: ["jpg","jpeg","png","webp"]
  }
});

const upload = multer({ storage });

/* ================= AUTH ================= */
function verifyAdmin(req,res,next){

  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({error:"No token"});

  try{
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if(decoded.role !== "admin"){
      return res.status(403).json({error:"Forbidden"});
    }

    req.admin = decoded;
    next();

  }catch(err){
    res.status(401).json({error:"Invalid token"});
  }
}

/* ================= ADMIN LOGIN ================= */
app.post("/admin-login", async (req,res)=>{
  try{

    const {email,password} = req.body;

    const admin = await Admin.findOne({email});
    if(!admin) return res.status(400).json({error:"Invalid login"});

    const match = await bcrypt.compare(password, admin.password);
    if(!match) return res.status(400).json({error:"Invalid login"});

    const token = jwt.sign(
      {id:admin._id, role:admin.role},
      JWT_SECRET,
      {expiresIn:"24h"}
    );

    res.json({token});

  }catch(err){
    res.status(500).json({error:"Server error"});
  }
});

/* ================= PRODUCTS ================= */

/* GET PRODUCTS */
app.get("/products", async (req,res)=>{
  try{
    const data = await Product.find().sort({_id:-1});
    res.json(data);
  }catch(err){
    res.status(500).json({error:"Failed to fetch products"});
  }
});

/* ADD PRODUCT */
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

    res.json({message:"Product added ✔"});

  }catch(err){
    res.status(500).json({error:"Upload failed"});
  }
});

/* UPDATE */
app.put("/product/:id", verifyAdmin, async (req,res)=>{
  try{
    await Product.findByIdAndUpdate(req.params.id,{
      name:req.body.name,
      price:req.body.price
    });

    res.json({message:"Updated ✔"});
  }catch(err){
    res.status(500).json({error:"Update failed"});
  }
});

/* DELETE */
app.delete("/product/:id", verifyAdmin, async (req,res)=>{
  try{
    await Product.findByIdAndDelete(req.params.id);
    res.json({message:"Deleted ✔"});
  }catch(err){
    res.status(500).json({error:"Delete failed"});
  }
});

/* ================= PESAPAL ================= */

const BASE_URL = "https://pay.pesapal.com/v3";

/* TOKEN */
async function getToken(){
  const res = await axios.post(`${BASE_URL}/api/Auth/RequestToken`,{
    consumer_key: process.env.PESAPAL_CONSUMER_KEY,
    consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
  });
  return res.data.token;
}

/* PAY (PUBLIC) */
app.post("/pesapal/pay", async (req,res)=>{
  try{

    const {amount,items} = req.body;

    console.log("🔥 PAYMENT:", amount);

    const token = await getToken();

    const orderId = "ORDER_" + Date.now();

/* SAVE ORDER */
await Order.create({
items,
total:amount,
orderTrackingId:orderId
});

const payload = {
id:orderId,
currency:"KES",
amount,
description:"Malone Store Payment",
callback_url:"https://phone-store-backend-9w7p.onrender.com/confirm.html",
notification_id:process.env.PESAPAL_IPN_ID,
billing_address:{
email_address:"customer@email.com",
phone_number:"0700000000",
country_code:"KE",
first_name:"Customer"
}
};

const response = await axios.post(
`${BASE_URL}/api/Transactions/SubmitOrderRequest`,
payload,
{
headers:{ Authorization:`Bearer ${token}` }
}
);

res.json(response.data);

}catch(err){
console.log(err.response?.data || err.message);

res.status(500).json({
error:"Payment failed",
details: err.response?.data || err.message
});
}
});

/* ================= ORDERS ================= */

/* CREATE ORDER (manual fallback) */
app.post("/order/pay", async (req,res)=>{
  try{

    const {items,total,user} = req.body;

    const order = new Order({
      userId:user?.id || "guest",
      fullName:user?.name || "Guest",
      email:user?.email || "",
      phone:user?.phone || "",
      address:user?.address || "",
      items,
      total
    });

    await order.save();

    res.json({success:true});

  }catch(err){
    res.status(500).json({error:"Order failed"});
  }
});

/* GET ORDERS */
app.get("/orders", verifyAdmin, async (req,res)=>{
  try{
    const orders = await Order.find().sort({date:-1});
    res.json(orders);
  }catch(err){
    res.status(500).json({error:"Fetch failed"});
  }
});

/* ================= TEST ================= */
app.get("/", (req,res)=>{
  res.send("🚀 MALONE SERVER RUNNING");
});

/* ================= START ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
  console.log("🚀 SERVER RUNNING ON PORT", PORT);
});
