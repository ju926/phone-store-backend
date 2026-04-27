const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ================= DATABASE ================= */

mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= IMAGE UPLOAD ================= */

const storage = multer.diskStorage({
destination:"uploads/",
filename:(req,file,cb)=>{
cb(null,Date.now()+path.extname(file.originalname));
}
});

const upload = multer({storage});

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
status:{type:String,default:"Pending"},
date:{type:Date,default:Date.now}
});

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"okola5775@gmail.com",
pass:"jzui tqah ngvi vmgc"
}
});

/* ================= BASE URL ================= */

const baseUrl = "https://phone-store-backend-9w7p.onrender.com";

/* ================= PRODUCTS ================= */

app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

app.post("/products", upload.single("image"), async (req,res)=>{
const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.filename
});

await product.save();
res.json({message:"Product added ✔"});
});

app.put("/product/:id", async (req,res)=>{
const p = await Product.findById(req.params.id);
p.price = req.body.price;
await p.save();
res.json({message:"Updated ✔"});
});

app.delete("/product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= ORDERS ================= */

app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

app.post("/order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

/* ================= INITIAL EMAIL ================= */

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`🧾 Invoice #${order._id}`,

html:`
<div style="font-family:Arial;padding:20px">

<h2>🧾 ORDER INVOICE</h2>

<p><b>Name:</b> ${order.fullName}</p>
<p><b>Phone:</b> ${order.phone}</p>
<p><b>Location:</b> ${order.location}</p>

<hr>

<h3>📦 Product</h3>

<img src="${baseUrl}/uploads/${order.items[0].image}"
style="width:120px;height:120px;object-fit:contain">

<p><b>${order.items[0].name}</b></p>
<p>KES ${order.items[0].price}</p>

<hr>

<p><b>Total:</b> KES ${order.total}</p>
<p>🚚 Delivery: ${order.deliveryDate}</p>

</div>
`
});

res.json({message:"Order placed ✔"});

});

/* ================= STATUS UPDATE + EMAIL ================= */

app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);

if(!order) return res.status(404).json({message:"Not found"});

order.status = req.body.status;
await order.save();

let message = "";

if(order.status === "Processing"){
message = "Your order is being prepared 🚚";
}

if(order.status === "Delivered"){
message = "Your order has been delivered 🎉";
}

/* SEND EMAIL ONLY FOR IMPORTANT STATUS */
if(order.status === "Processing" || order.status === "Delivered"){

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

<p><b>Item:</b> ${order.items[0].name}</p>
<p><b>Total:</b> KES ${order.total}</p>

<p>🚚 Delivery Date: ${order.deliveryDate}</p>

</div>
`
});

}

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
