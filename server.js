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

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI)
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
total:Number,
status:{type:String,default:"Pending"},
paymentMethod:String,
transactionCode:String,
date:{type:Date,default:Date.now}
});

/* ================= EMAIL SETUP ================= */
const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: process.env.GMAIL_USER,
pass: process.env.GMAIL_PASS
}
});

/* ================= SEND EMAIL ================= */
async function sendOrderEmail(order){

try{

await transporter.sendMail({
from: process.env.GMAIL_USER,
to: order.email,
subject: "🛒 Order Confirmation - Phone Store",
html: `
<h2>Hi ${order.fullName} 👋</h2>

<p>Your order has been received successfully.</p>

<hr>

<p><b>Order ID:</b> ${order._id}</p>
<p><b>Total:</b> KES ${order.total}</p>
<p><b>Status:</b> ${order.status}</p>

<hr>

<p>We will update you once your order is processed.</p>

<h3>Thank you for shopping with us 🛍</h3>
`
});

console.log("📧 Email sent ✔");

}catch(err){
console.log("Email error:", err);
}

}

/* ================= CLOUDINARY ================= */
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
cloudinary,
params:{
folder:"phone-store",
allowed_formats:["jpg","jpeg","png","webp"]
}
});

const upload = multer({ storage });

/* ================= TEST ================= */
app.get("/",(req,res)=>{
res.send("Server Running ✔");
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find().sort({_id:-1}));
});

app.post("/products", upload.single("image"), async (req,res)=>{

try{

if(!req.file){
return res.status(400).json({error:"No image uploaded"});
}

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.path
});

await product.save();

res.json({message:"Product added ✔"});

}catch(err){
console.log(err);
res.status(500).json({error:"Upload failed"});
}

});

/* ================= DELETE PRODUCT ================= */
app.delete("/product/:id", async (req,res)=>{
try{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Product deleted ✔"});
}catch(err){
res.status(500).json({error:"Delete failed"});
}
});

/* ================= ORDERS ================= */
app.get("/orders", async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= SINGLE ORDER ================= */
app.get("/order/:id", async (req,res)=>{
try{
const order = await Order.findById(req.params.id);
res.json(order);
}catch(err){
res.status(500).json({error:"Order not found"});
}
});

/* ================= DELETE ORDER ================= */
app.delete("/order/:id", async (req,res)=>{
try{
await Order.findByIdAndDelete(req.params.id);
res.json({message:"Order deleted ✔"});
}catch(err){
res.status(500).json({error:"Delete failed"});
}
});

/* ================= UPDATE STATUS ================= */
app.put("/update-order-status/:id", async (req,res)=>{
try{

const order = await Order.findByIdAndUpdate(
req.params.id,
{ status:req.body.status },
{ new:true }
);

/* OPTIONAL: send email on delivery */
if(req.body.status === "Delivered"){
sendOrderEmail(order);
}

res.json({message:"Status updated ✔"});

}catch(err){
res.status(500).json({error:"Update failed"});
}
});

/* ================= CREATE ORDER + EMAIL ================= */
app.post("/order/pay", async (req, res) => {

try {

const { name, email, phone, items, total } = req.body;

if (!name || !email || !phone || !items || items.length === 0) {
return res.status(400).json({ success:false, message:"Missing data" });
}

const order = new Order({
fullName: name,
phone,
email,
location: "Online Checkout",
items,
total,
paymentMethod: "PayNow",
status: "Pending"
});

await order.save();

/* 🔥 SEND EMAIL AFTER ORDER */
sendOrderEmail(order);

return res.json({
success: true,
orderId: order._id,
message: "Order created ✔"
});

} catch (err) {

console.log(err);
res.status(500).json({ success:false, message:"Server error" });

}

});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on port", PORT);
});
