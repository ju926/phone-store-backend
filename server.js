require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const path = require("path");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI)
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
status:{type:String,default:"Pending"},
paymentMethod:String,
transactionCode:String,
date:{type:Date,default:Date.now}
});

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:process.env.GMAIL_USER,
pass:process.env.GMAIL_PASS
}
});

/* ================= BASE ================= */
const baseUrl = "https://phone-store-backend-9w7p.onrender.com";

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ================= ADD PRODUCT ================= */
app.post("/products", multer().single("image"), async (req,res)=>{

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file ? req.file.filename : req.body.image
});

await product.save();
res.json({message:"Product added ✔"});
});

/* ================= UPDATE PRODUCT ================= */
app.put("/product/:id", async (req,res)=>{
const p = await Product.findById(req.params.id);
p.price = req.body.price;
await p.save();
res.json({message:"Updated ✔"});
});

/* ================= DELETE PRODUCT ================= */
app.delete("/product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= CREATE ORDER ================= */
app.post("/order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

/* EMAIL */
await transporter.sendMail({
from:"Store <"+process.env.GMAIL_USER+">",
to:order.email,
subject:"🧾 Order Received",
html:`
<h2>Order Received</h2>
<p>Name: ${order.fullName}</p>
<p>Total: KES ${order.total}</p>
<p>Status: Pending</p>
`
});

res.json({message:"Order placed ✔"});
});

/* ================= UPDATE STATUS ================= */
app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);
order.status = req.body.status;
await order.save();

/* EMAIL NOTIFICATION */
await transporter.sendMail({
from:"Store <"+process.env.GMAIL_USER+">",
to:order.email,
subject:"📦 Order Update",
html:`
<h2>Status Update</h2>
<p>Status: ${order.status}</p>
<p>Total: KES ${order.total}</p>
`
});

res.json({message:"Updated ✔"});
});

/* ================= PESPAL PAYMENT ================= */
app.post("/pesapal/pay", async (req,res)=>{

try{

const tokenRes = await axios.post(
"https://pay.pesapal.com/v3/api/Auth/RequestToken",
{
consumer_key: process.env.PESAPAL_CONSUMER_KEY,
consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
}
);

const token = tokenRes.data.token;

const payment = {
id: Date.now().toString(),
currency: "KES",
amount: req.body.total,
description: "Store Purchase",
callback_url: process.env.CALLBACK_URL,
billing_address:{
email_address: req.body.email || "test@gmail.com",
phone_number: req.body.phone || "0700000000",
first_name: req.body.name || "Customer"
}
};

const response = await axios.post(
"https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest",
payment,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);

res.json({
redirect_url: response.data.redirect_url
});

}catch(err){
console.log(err);
res.status(500).json({error:"Payment failed"});
}

});

/* ================= CALLBACK ================= */
app.get("/callback",(req,res)=>{
console.log("Pesapal callback:",req.query);
res.send("Payment received ✔");
});

/* ================= DELETE ORDER ================= */
app.delete("/order/:id", async (req,res)=>{
await Order.findByIdAndDelete(req.params.id);
res.json({message:"Deleted ✔"});
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT,()=>{
console.log("Server running on " + PORT);
});
