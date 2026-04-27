const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const africastalking = require("africastalking")({
apiKey: "atsk_6ed16e060eb34b496c53914e619761dedd73be3fd152d6b67c06317242ed135a9e127c94",
username: "sandbox"
});

const sms = africastalking.SMS;

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ================= MONGO ================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/* ================= MULTER ================= */
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
res.json({message:"Added ✔"});
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

/* FORMAT PHONE */
let phone = req.body.phone;
if(phone.startsWith("07")){
phone = "+254" + phone.slice(1);
}

/* SAVE ORDER */
const order = new Order({
fullName:req.body.fullName,
phone:phone,
email:req.body.email,
location:req.body.location,
items:req.body.items,
total:req.body.total,
deliveryDate:req.body.deliveryDate
});

await order.save();

/* SEND EMAIL */
await transporter.sendMail({
from:"Store <YOUR_GMAIL@gmail.com>",
to:order.email,
subject:"🛒 Order Confirmation",
html:`
<h2>Thank you for your order 🎉</h2>

<p><b>Name:</b> ${order.fullName}</p>
<p><b>Phone:</b> ${order.phone}</p>
<p><b>Location:</b> ${order.location}</p>

<h3>Items:</h3>
<ul>
${order.items.map(i=>`
<li>${i.name} - KES ${i.price}</li>
`).join("")}
</ul>

<p><b>Total:</b> KES ${order.total}</p>

<p><b>Status:</b> ${order.status}</p>

<p style="color:orange;">
🚚 Delivery by: ${order.deliveryDate}
</p>
`
});

/* SEND SMS */
await sms.send({
to: phone,
message: `Hi ${order.fullName}, your order for ${order.items[0].name} (KES ${order.total}) is confirmed ✔. Delivery by ${order.deliveryDate}.`
});

res.json({message:"Order placed ✔"});

}catch(err){
console.log("ORDER ERROR:", err.message);
res.status(500).json({message:"Error"});
}

});

/* UPDATE STATUS + SMS */

app.put("/update-order-status/:id", async (req,res)=>{

const order = await Order.findById(req.params.id);

order.status = req.body.status;
await order.save();

/* SEND SMS UPDATE */
await sms.send({
to: order.phone,
message: `Hi ${order.fullName}, your order status is now: ${order.status}.`
});

res.json({message:"Updated ✔"});
});

/* DELETE ORDER */

app.delete("/order/:id", async (req,res)=>{
await Order.findByIdAndDelete(req.params.id);
res.json({message:"Deleted"});
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
