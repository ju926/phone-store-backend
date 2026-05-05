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

app.use(cors());
app.use(express.json());

/* ================= ENV ================= */
const MONGO_URI = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "malone_admin_secret";

/* ================= DB ================= */
mongoose.connect(MONGO_URI)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= MODELS ================= */

/* ADMIN */
const Admin = mongoose.model("Admin",{
email:String,
password:String,
role:{type:String,default:"admin"}
});

/* PRODUCT */
const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String
});

/* ORDER */
const Order = mongoose.model("Order",{
userId:String,
fullName:String,
email:String,
phone:String,
address:String,
items:Array,
total:Number,
status:{type:String,default:"Pending"},
paymentMethod:{type:String,default:"PesaPal"},
paymentStatus:{type:String,default:"Pending"},
orderTrackingId:String,
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
res.json(await Product.find());
});

app.post("/products", verifyAdmin, upload.single("image"), async (req,res)=>{

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

});

app.put("/product/:id", verifyAdmin, async (req,res)=>{

await Product.findByIdAndUpdate(req.params.id,{
$set:{
name:req.body.name,
price:req.body.price
}
});

res.json({message:"Updated ✔"});

});

app.delete("/product/:id", verifyAdmin, async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= ORDERS ================= */

/* OLD MANUAL ORDER (UNCHANGED) */
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
total,
status:"Pending"
});

await order.save();

res.json({success:true,message:"Order placed ✔"});

}catch(err){
res.status(500).json({error:"Server error"});
}

});

/* ================= PESAPAL ================= */

/* GET TOKEN */
async function getPesapalToken(){

const res = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Auth/RequestToken`,
{
consumer_key: process.env.PESAPAL_CONSUMER_KEY,
consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
}
);

return res.data.token;
}

/* INITIATE PAYMENT */
app.post("/pesapal/pay", async (req,res)=>{

try{

const {amount,items,user} = req.body;

const token = await getPesapalToken();

const orderId = "ORDER_"+Date.now();

/* SAVE ORDER FIRST */
await Order.create({
userId:user?.id || "guest",
fullName:user?.name || "Guest",
email:user?.email || "",
phone:user?.phone || "",
address:user?.address || "",
items,
total:amount,
paymentMethod:"PesaPal",
paymentStatus:"Pending",
orderTrackingId:orderId
});

/* SEND TO PESAPAL */
const response = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
{
id: orderId,
currency: "KES",
amount,
description: "Phone Purchase",
callback_url: "https://yourdomain.com/confirm.html",
notification_id: process.env.PESAPAL_IPN_ID,
billing_address:{
email_address:user?.email || "customer@email.com",
phone_number:user?.phone || "0700000000",
country_code:"KE",
first_name:user?.name || "Customer"
}
},
{
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
}
}
);

res.json(response.data);

}catch(err){
console.log(err.response?.data || err.message);
res.status(500).json({error:"Payment failed"});
}

});

/* CHECK STATUS + UPDATE ORDER */
app.get("/pesapal/status/:id", async (req,res)=>{

try{

const token = await getPesapalToken();

const response = await axios.get(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${req.params.id}`,
{
headers:{Authorization:`Bearer ${token}`}
}
);

const data = response.data;

/* UPDATE ORDER */
if(data.payment_status === "COMPLETED"){
await Order.findOneAndUpdate(
{orderTrackingId:req.params.id},
{paymentStatus:"Paid",status:"Processing"}
);
}

res.json(data);

}catch(err){
res.status(500).json({error:"Status failed"});
}

});

/* ================= ADMIN ORDERS ================= */
app.get("/orders", verifyAdmin, async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 MALONE SERVER RUNNING ON PORT", PORT);
});
