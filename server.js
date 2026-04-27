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
.catch(err=>console.log("Mongo Error:",err));

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

/* ================= EMAIL SETUP ================= */

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"YOUR_GMAIL@gmail.com",
pass:"YOUR_APP_PASSWORD"
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

app.delete("/product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted"});
});

app.put("/product/:id", async (req,res)=>{
const p = await Product.findById(req.params.id);
p.price = req.body.price;
await p.save();
res.json({message:"Updated"});
});

/* ================= ORDERS ================= */

app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

app.post("/order", async (req,res)=>{

try{

const order = new Order({
fullName:req.body.fullName,
phone:req.body.phone,
email:req.body.email,
location:req.body.location,
items:req.body.items,
total:req.body.total,
deliveryDate:req.body.deliveryDate
});

await order.save();

/* ================= EMAIL INVOICE ================= */

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`🧾 Invoice #${order._id}`,

html:`
<div style="font-family:Arial;background:#f4f4f4;padding:20px">

<div style="max-width:600px;margin:auto;background:white;padding:20px;border-radius:10px">

<h2 style="text-align:center;color:#2563eb;">🧾 ORDER INVOICE</h2>

<p><b>Invoice ID:</b> ${order._id}</p>
<p><b>Name:</b> ${order.fullName}</p>
<p><b>Phone:</b> ${order.phone}</p>
<p><b>Location:</b> ${order.location}</p>

<hr>

<h3>🛒 Product</h3>

<div style="display:flex;gap:10px;border:1px solid #ddd;padding:10px;border-radius:10px">

<img src="${baseUrl}/uploads/${order.items[0].image}"
style="width:100px;height:100px;object-fit:contain;border-radius:10px">

<div>
<p><b>${order.items[0].name}</b></p>
<p>KES ${order.items[0].price}</p>
</div>

</div>

<hr>

<h3>💰 Summary</h3>

<p>Subtotal: KES ${order.total}</p>
<p><b>Total: KES ${order.total}</b></p>

<hr>

<p style="color:green;">
🚚 Delivery Date: <b>${order.deliveryDate}</b>
</p>

<p>Status: <b>${order.status}</b></p>

<hr>

<p style="text-align:center;color:gray;font-size:12px">
Thank you for shopping with us 🙏
</p>

</div>

</div>
`
});

res.json({message:"Order placed ✔"});

}catch(err){
console.log("ORDER ERROR:",err.message);
res.status(500).json({message:"Error"});
}

});

/* ================= STATUS UPDATE ================= */

app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);
order.status = req.body.status;
await order.save();

res.json({message:"Status updated ✔"});
});

/* ================= DELETE ORDER ================= */

app.delete("/order/:id", async (req,res)=>{
await Order.findByIdAndDelete(req.params.id);
res.json({message:"Order deleted"});
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
