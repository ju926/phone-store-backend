const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());

/* DB */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

/* MODELS */
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

/* EMAIL */
const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"okola5775@gmail.com",
pass:"jzui tqah ngvi vmgc"
}
});

/* PRODUCTS */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

/* ORDERS */
app.get("/orders", async (req,res)=>{
try{
res.json(await Order.find().sort({date:-1}));
}catch(err){
res.json([]);
}
});

/* PLACE ORDER */
app.post("/order", async (req,res)=>{

const items = (req.body.items ?? []).map(i=>({
name:i?.name ?? "Unknown",
price:Number(i?.price ?? 0),
image:i?.image ?? ""
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

res.json({message:"OK"});
});

app.listen(10000,()=>console.log("Server running"));
