const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= MONGO DB ================= */
const MONGO_URL = "mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store?retryWrites=true&w=majority";

mongoose.connect(MONGO_URL)
.then(() => console.log("MongoDB Connected ✔"))
.catch(err => console.log("MongoDB Error:", err.message));

/* ================= MODELS ================= */
const Product = mongoose.model("Product", {
name: String,
price: Number,
image: String
});

const Order = mongoose.model("Order", {
fullName: String,
phone: String,
email: String,
location: String,
items: Array,
status: { type: String, default: "Pending" },
date: { type: Date, default: Date.now }
});

/* ================= EMAIL SETUP ================= */
const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: "okola5775@gmail.com",
pass: "jzui tqah ngvi vmgc"
}
});

/* ================= TEST ROUTE ================= */
app.get("/", (req,res)=>{
res.send("Server running ✔");
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
try{
const data = await Product.find();
res.json(data);
}catch(err){
res.status(500).json([]);
}
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
try{
const orders = await Order.find().sort({date:-1});
res.json(orders);
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

/* EMAIL TO BUYER */
if(order.email){

await transporter.sendMail({
from: "Store <YOUR_GMAIL@gmail.com>",
to: order.email,
subject: "🛒 Order Confirmation",
html: `
<h2>Hi ${order.fullName}</h2>

<p>Your order has been received ✔</p>

<p><b>Status:</b> Pending</p>

<h3>Items:</h3>
<ul>
${items.map(i=>`
<li>${i.name} - KES ${i.price}</li>
`).join("")}
</ul>

<p>We will update you soon 📦</p>
`
});

console.log("Email sent ✔");
}

res.json({ message: "Order placed ✔", orderId: order._id });

}catch(err){
console.log("ORDER ERROR:", err.message);
res.status(500).json({ message: "Order failed" });
}

});

/* ================= UPDATE STATUS ================= */
app.put("/update-order-status/:id", async (req,res)=>{

try{

const order = await Order.findById(req.params.id);

order.status = req.body.status;
await order.save();

/* EMAIL UPDATE */
await transporter.sendMail({
from: "Store <YOUR_GMAIL@gmail.com>",
to: order.email,
subject: `📦 Order Update: ${order.status}`,
html: `
<h2>Order Update</h2>

<p>Name: ${order.fullName}</p>
<p>Status: <b>${order.status}</b></p>

<p>Thank you for shopping with us ✔</p>
`
});

res.json({ message: "Status updated ✔" });

}catch(err){
console.log(err.message);
res.status(500).json({ message: "Update failed" });
}

});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, ()=>{
console.log("Server running on port " + PORT);
});
