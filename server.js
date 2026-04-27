const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

if(!fs.existsSync("uploads")) fs.mkdirSync("uploads");

/* ================= DB (YOUR URL) ================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("DB ERROR:", err));

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
user:"okolajulian@gmail.com",
pass:"lchm zooe ygco adub"
}
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* PLACE ORDER */
app.post("/order", async (req,res)=>{

const items = (req.body.items ?? []).map(i=>({
name:i?.name ?? "Unknown",
price:Number(i?.price ?? 0)
}));

const order = new Order({
...req.body,
items
});

await order.save();

/* EMAIL */
await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:"Order Received ✔",
html:`<h2>Thanks ${order.fullName}</h2><p>Status: ${order.status}</p>`
});

res.json({message:"Order placed"});
});

/* UPDATE STATUS + EMAIL */
app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);

order.status = req.body.status;
await order.save();

await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`Order Update: ${order.status}`,
html:`
<h2>Your Order Update</h2>
<p>Name: ${order.fullName}</p>
<p>Status: <b>${order.status}</b></p>
`
});

res.json({message:"Updated + Email sent"});
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
