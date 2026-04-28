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
api_secret: "F60T1ktvNpmGF4OOf8i9U-jJ2p0" // ⚠️ regenerate this
});

/* ================= CLOUDINARY STORAGE ================= */

const storage = new CloudinaryStorage({
cloudinary: cloudinary,
params: {
folder: "phone-store",
allowed_formats: ["jpg","png","jpeg"]
}
});

const upload = multer({ storage });

/* ================= DATABASE ================= */

mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

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
paymentStatus:{type:String,default:"paid"},
status:{type:String,default:"Pending"},
date:{type:Date,default:Date.now}
});

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"jzui tqah ngvi vmgc",
pass:"YOUR_APP_PASSWORD"
}
});

/* ================= PRODUCTS ================= */

app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ================= ADD PRODUCT (CLOUDINARY) ================= */

app.post("/products", upload.single("image"), async (req,res)=>{

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path   // ✅ CLOUDINARY URL
});

await product.save();
res.json({message:"Product added ✔"});
});

/* ================= ORDER ================= */

app.post("/order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

/* EMAIL RECEIPT (JUMIA STYLE) */

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`🧾 Invoice #${order._id}`,

html:`
<div style="font-family:Arial;padding:20px">

<h2>🧾 ORDER RECEIPT</h2>

<p><b>Name:</b> ${order.fullName}</p>
<p><b>Phone:</b> ${order.phone}</p>
<p><b>Location:</b> ${order.location}</p>

<hr>

<h3>📦 Items</h3>

${order.items.map(i=>`
<div style="margin-bottom:15px">
<img src="${i.image}" style="width:120px;height:120px;object-fit:contain"><br>
<b>${i.name}</b><br>
KES ${i.price}
</div>
`).join("")}

<hr>

<p><b>Total:</b> KES ${order.total}</p>
<p>🚚 Delivery: ${order.deliveryDate}</p>

</div>
`
});

res.json({message:"Order placed ✔"});
});

/* ================= STATUS UPDATE ================= */

app.put("/update-order-status/:id", async (req,res)=>{

const order = await mongoose.model("Order").findById(req.params.id);

if(!order) return res.status(404).json({message:"Not found"});

order.status = req.body.status;
await order.save();

/* EMAIL UPDATE */
await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`📦 Order Update: ${order.status}`,

html:`
<div style="font-family:Arial;padding:20px">

<h2>📦 Order Update</h2>

<p>Hi ${order.fullName},</p>

<p>Status: <b>${order.status}</b></p>

<p>🚚 Delivery: ${order.deliveryDate}</p>

</div>
`
});

res.json({message:"Status updated ✔"});
});

/* ================= ORDERS ================= */

app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
