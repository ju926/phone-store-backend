const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */
mongoose.connect("mongodb+srv://storeUser:storePass123@store.eggjy60.mongodb.net/store?retryWrites=true&w=majority")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("MongoDB Error:", err.message));

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
user:"YOUR_GMAIL@gmail.com",
pass:"YOUR_16_DIGIT_APP_PASSWORD"
}
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
try{
res.json(await Product.find());
}catch(err){
res.status(500).json([]);
}
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
try{
res.json(await Order.find().sort({date:-1}));
}catch(err){
res.status(500).json([]);
}
});

/* ================= PLACE ORDER ================= */
app.post("/order", async (req,res)=>{

try{

const items = (req.body.items ?? []).map(i => ({
name: i?.name ?? "Unknown Product",
price: Number(i?.price ?? 0),
image: i?.image ?? ""
}));

const order = new Order({
fullName: req.body.fullName,
phone: req.body.phone,
email: req.body.email,
location: req.body.location,
items: items,
status: "Pending"
});

await order.save();

/* ================= EMAIL TO BUYER ================= */
if(order.email){

await transporter.sendMail({
from:"Malone Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:"🛒 Order Confirmation",
html:`
<h2>Hi ${order.fullName}</h2>

<p>Your order has been received ✔</p>

<p><b>Status:</b> ${order.status}</p>

<h3>Items:</h3>
<ul>
${items.map(i=>`
<li>${i.name} - KES ${i.price}</li>
`).join("")}
</ul>

<p>We will update you soon 📦</p>
<hr>
<p>Malone Phone Store</p>
`
});

console.log("Email sent to buyer ✔");
}

res.json({
message:"Order placed successfully ✔",
orderId: order._id
});

}catch(err){
console.log("ORDER ERROR:", err.message);
res.status(500).json({message:"Order failed"});
}

});

/* ================= UPDATE STATUS + EMAIL ================= */
app.put("/update-order-status/:id", async (req,res)=>{

try{

const order = await Order.findById(req.params.id);

order.status = req.body.status;
await order.save();

/* EMAIL UPDATE */
await transporter.sendMail({
from:"Malone Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:`📦 Order Update: ${order.status}`,
html:`
<h2>Order Status Updated</h2>

<p><b>Name:</b> ${order.fullName}</p>
<p><b>Status:</b> ${order.status}</p>

<p>Thank you for shopping with us ✔</p>
`
});

res.json({message:"Status updated + email sent ✔"});

}catch(err){
console.log(err);
res.status(500).json({message:"Update failed"});
}

});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, ()=>{
console.log("Server running on port " + PORT);
});
