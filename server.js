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

/* ================= HEALTH CHECK ================= */
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

if(!admin){
return res.status(400).json({error:"Invalid login"});
}

const match = await bcrypt.compare(password,admin.password);

if(!match){
return res.status(400).json({error:"Invalid login"});
}

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

if(!auth){
return res.status(401).json({error:"No token"});
}

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
app.post(
"/products",
verifyAdmin,
upload.single("image"),
async (req,res)=>{

try{

if(!req.file){
return res.status(400).json({
error:"No image uploaded"
});
}

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path
});

await product.save();

res.json({
success:true,
message:"Product uploaded ✔"
});

}catch(err){

console.log(err);

res.status(500).json({
error:"Upload failed"
});

}

});

/* UPDATE PRODUCT */
app.put("/product/:id", verifyAdmin, async (req,res)=>{

await Product.findByIdAndUpdate(
req.params.id,
{
name:req.body.name,
price:req.body.price
}
);

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

const order = new Order({
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

await order.save();

res.json({
success:true,
message:"Order saved ✔"
});

}catch(err){

res.status(500).json({
error:"Order failed"
});

}

});

/* ================= PESAPAL PAYMENT ================= */
app.post("/pesapal/pay", async (req,res)=>{

try{

const {items,total} = req.body;

console.log("🔥 PAYMENT:", total);

/* TOKEN */
const tokenRes = await axios.post(
"https://pay.pesapal.com/v3/api/Auth/RequestToken",
{
consumer_key:
process.env.PESAPAL_CONSUMER_KEY,

consumer_secret:
process.env.PESAPAL_CONSUMER_SECRET
}
);

const token = tokenRes.data.token;

/* ORDER ID */
const orderId = "ORDER_" + Date.now();

/* PAYMENT PAYLOAD */
const payload = {

id: orderId,

currency: "KES",

amount: total,

description: "Malone Store Purchase",

/* IMPORTANT */
callback_url:
"https://phone-store-backend-9w7p.onrender.com/payment-status",

notification_id:
process.env.PESAPAL_IPN_ID,

billing_address:{
email_address:"customer@email.com",
phone_number:"0700000000",
country_code:"KE",
first_name:"Customer"
}

};

/* SEND REQUEST */
const response = await axios.post(
"https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest",
payload,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

/* SAVE ORDER */
await Order.create({
orderId,
items,
total,
status:"Pending"
});

/* RETURN RESPONSE */
res.json(response.data);

}catch(err){

console.log(
"❌ PESAPAL ERROR:",
err.response?.data || err.message
);

res.status(500).json({
error:"Payment failed",
details:err.response?.data || err.message
});

}

});

/* ================= VERIFY PAYMENT ================= */
app.get("/payment-status", async (req,res)=>{

try{

const trackingId =
req.query.OrderTrackingId;

const orderId =
req.query.OrderMerchantReference;

if(!trackingId){
return res.redirect("/failed.html");
}

/* TOKEN */
const tokenRes = await axios.post(
"https://pay.pesapal.com/v3/api/Auth/RequestToken",
{
consumer_key:
process.env.PESAPAL_CONSUMER_KEY,

consumer_secret:
process.env.PESAPAL_CONSUMER_SECRET
}
);

const token = tokenRes.data.token;

/* VERIFY */
const statusRes = await axios.get(
`https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

console.log(
"PAYMENT STATUS:",
statusRes.data
);

const paymentStatus =
statusRes.data.payment_status_description;

/* SUCCESS */
if(paymentStatus === "Completed"){

await Order.findOneAndUpdate(
{orderId},
{status:"Paid"}
);

return res.redirect(
`/confirm.html?orderId=${orderId}&trackingId=${trackingId}`
);

}

/* FAILED */
await Order.findOneAndUpdate(
{orderId},
{status:"Failed"}
);

return res.redirect("/failed.html");

}catch(err){

console.log(
"VERIFY ERROR:",
err.response?.data || err.message
);

return res.redirect("/failed.html");

}

});

/* ================= HTML ROUTES ================= */
app.get("/confirm.html", (req,res)=>{
res.sendFile(
path.join(__dirname,"confirm.html")
);
});

app.get("/failed.html", (req,res)=>{
res.sendFile(
path.join(__dirname,"failed.html")
);
});

/* ================= ORDERS ================= */
app.get("/orders", verifyAdmin, async (req,res)=>{
res.json(
await Order.find().sort({date:-1})
);
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log(
"🚀 MALONE SERVER RUNNING ON PORT",
PORT
);
});
