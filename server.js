const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ================= MONGO DB ================= */
const MONGO_URL = "mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store?retryWrites=true&w=majority";

mongoose.connect(MONGO_URL)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("MongoDB Error:", err.message));

/* ================= STORAGE (IMAGES) ================= */
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

/* ================= TEST ================= */
app.get("/",(req,res)=>{
res.send("Server Running ✔");
});

/* ================= PRODUCTS ================= */

// GET
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

// ADD PRODUCT (WITH IMAGE)
app.post("/products", upload.single("image"), async (req,res)=>{

try{

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.filename
});

await product.save();

res.json({message:"Product added ✔"});

}catch(err){
res.status(500).json({message:"Add failed"});
}

});

// DELETE PRODUCT
app.delete("/product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

// UPDATE PRICE
app.put("/product/:id", async (req,res)=>{

const product = await Product.findById(req.params.id);
product.price = req.body.price;
await product.save();

res.json({message:"Price updated ✔"});

});

/* ================= ORDERS ================= */

// GET ORDERS
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

// PLACE ORDER
app.post("/order", async (req,res)=>{

try{

const items = (req.body.items || []).map(i=>({
name:i?.name,
price:i?.price,
image:i?.image
}));

const order = new Order({
fullName:req.body.fullName,
phone:req.body.phone,
email:req.body.email,
location:req.body.location,
items
});

await order.save();

/* EMAIL TO BUYER */
if(order.email){

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:"🛒 Order Received",
html:`
<h2>Hi ${order.fullName}</h2>
<p>Your order is received ✔</p>

<p>Status: Pending</p>

<ul>
${items.map(i=>`
<li>${i.name} - KES ${i.price}</li>
`).join("")}
</ul>
`
});

}

res.json({message:"Order placed ✔"});

}catch(err){
res.status(500).json({message:"Order failed"});
}

});

// UPDATE STATUS + EMAIL
app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);
order.status = req.body.status;
await order.save();

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`📦 Order ${order.status}`,
html:`
<h2>Status Update</h2>
<p>${order.fullName}</p>
<p><b>${order.status}</b></p>
`
});

res.json({message:"Updated ✔"});

});

// DELETE ORDER
app.delete("/order/:id", async (req,res)=>{
await Order.findByIdAndDelete(req.params.id);
res.json({message:"Order deleted ✔"});
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
