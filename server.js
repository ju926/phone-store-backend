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
const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path
});

await product.save();
res.json({message:"Product added ✔"});
});

/* ================= ORDERS ================= */
app.get("/orders", verifyAdmin, async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= PESAPAL ================= */

/* GET TOKEN */
async function getToken(){
const res = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Auth/RequestToken`,
{
consumer_key:process.env.PESAPAL_CONSUMER_KEY,
consumer_secret:process.env.PESAPAL_CONSUMER_SECRET
}
);
return res.data.token;
}

/* INITIATE PAYMENT */
app.post("/pesapal/pay", async (req,res)=>{

try{

const {amount,items} = req.body;

const token = await getToken();

const orderId = "ORDER_"+Date.now();

/* SAVE ORDER */
await Order.create({
fullName:"Customer",
email:"",
phone:"",
items,
total:amount,
orderTrackingId:orderId,
paymentStatus:"Pending"
});

/* PESAPAL REQUEST */
const response = await axios.post(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
{
id:orderId,
currency:"KES",
amount,
description:"Phone Store Purchase",
callback_url:"https://yourdomain.com/confirm.html",
notification_id:process.env.PESAPAL_IPN_ID,
billing_address:{
email_address:"customer@email.com",
phone_number:"0700000000",
country_code:"KE",
first_name:"Customer"
}
},
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

res.json(response.data);

}catch(err){
console.log(err.response?.data || err.message);
res.status(500).json({error:"Payment failed"});
}
});

/* CHECK STATUS */
app.get("/pesapal/status/:id", async (req,res)=>{

try{

const token = await getToken();

const response = await axios.get(
`${process.env.PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${req.params.id}`,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

if(response.data.payment_status === "COMPLETED"){
await Order.findOneAndUpdate(
{orderTrackingId:req.params.id},
{paymentStatus:"Paid",status:"Processing"}
);
}

res.json(response.data);

}catch(err){
res.status(500).json({error:"Status error"});
}
});

const PORT = process.env.PORT || 10000;
app.listen(PORT,()=>console.log("Server running ✔"));
