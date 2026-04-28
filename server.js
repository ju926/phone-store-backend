const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CLOUDINARY CONFIG ================= */

cloudinary.config({
cloud_name: "driwjor64",
api_key: "767812144924935",
api_secret: "F60T1ktvNpmGF4OOf8i9U-jJ2p0"
});

/* ================= CLOUDINARY STORAGE ================= */

const storage = new CloudinaryStorage({
cloudinary,
params:{
folder:"phone-store",
allowed_formats:["jpg","png","jpeg"]
}
});

const upload = multer({ storage });

/* ================= DATABASE ================= */

mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"okola5775@gmail.com",
pass:"jzui tqah ngvi vmgc"
}
});

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
deliveryDate:String,

transactionCode:String,
paymentStatus:{type:String,default:"pending_verification"},
status:{type:String,default:"Processing"},

date:{type:Date,default:Date.now}
});

/* ================= PRODUCTS ================= */

app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ADD PRODUCT (CLOUDINARY FIXED) */
app.post("/products", upload.single("image"), async (req,res)=>{

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path   // ✅ CLOUDINARY URL
});

await product.save();

res.json({message:"Product added ✔"});
});

/* ================= ORDER CREATE ================= */

app.post("/order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

/* EMAIL: PROCESSING */
await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`📦 Order Received - Processing`,

html:`
<div style="font-family:Arial;padding:20px">

<h2>📦 Order Received</h2>

<p>Hi ${order.fullName},</p>

<p>Your order has been received and is being processed.</p>

<hr>

<p><b>Transaction Code:</b> ${order.transactionCode}</p>
<p><b>Status:</b> Processing</p>

<hr>

<p><b>Total:</b> KES ${order.total}</p>
<p>🚚 Delivery: ${order.deliveryDate}</p>

</div>
`
});

res.json({message:"Order placed ✔"});
});

/* ================= GET ORDERS ================= */

app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= UPDATE STATUS (ADMIN) ================= */

app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);

if(!order){
return res.status(404).json({message:"Order not found"});
}

order.status = req.body.status;
await order.save();

/* EMAIL UPDATE */
let message = "";

if(order.status === "Processing"){
message = "Your order is being prepared 🚚";
}

if(order.status === "Delivered"){
message = "Your order has been delivered 🎉";
}

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`📦 Order Update: ${order.status}`,

html:`
<div style="font-family:Arial;padding:20px">

<h2>📦 Order Update</h2>

<p>Hi ${order.fullName},</p>

<p><b>Status:</b> ${order.status}</p>

<p style="color:green">${message}</p>

<hr>

<p><b>Transaction Code:</b> ${order.transactionCode}</p>
<p><b>Total:</b> KES ${order.total}</p>
<p>🚚 Delivery: ${order.deliveryDate}</p>

</div>
`
});

res.json({message:"Status updated ✔"});
});

/* ================= DELETE ORDER ================= */

app.delete("/order/:id", async (req,res)=>{
await Order.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
