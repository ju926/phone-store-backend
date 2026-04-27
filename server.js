const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* =========================
   UPLOAD FOLDER (RENDER SAFE)
========================= */
if (!fs.existsSync("uploads")) {
fs.mkdirSync("uploads");
}

/* =========================
   DB CONNECTION
========================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("DB ERROR:", err));

/* =========================
   MODELS
========================= */
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
date:{type:Date,default:Date.now}
});

/* =========================
   MULTER
========================= */
const storage = multer.diskStorage({
destination:(req,file,cb)=>{
cb(null,"uploads/");
},
filename:(req,file,cb)=>{
cb(null, Date.now() + path.extname(file.originalname));
}
});

const upload = multer({storage});

/* =========================
   EMAIL SETUP
========================= */
const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"okola5775@gmail.com",
pass:"flng ceog farw veyp"
}
});

/* DEBUG */
console.log("📧 Email system initialized");

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req,res)=>{
res.send("Store API Running ✔");
});

/* =========================
   PRODUCTS
========================= */
app.get("/products", async (req,res)=>{
const products = await Product.find();
res.json(products);
});

/* ADD PRODUCT */
app.post("/add-product-upload", upload.single("image"), async (req,res)=>{

try{

console.log("🔥 PRODUCT UPLOAD HIT");
console.log(req.body);

if(!req.file){
return res.status(400).json({message:"No image uploaded"});
}

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file.filename
});

await product.save();

res.json(product);

}catch(err){
console.log("UPLOAD ERROR:", err);
res.status(500).json({message:"Upload failed"});
}

});

/* UPDATE PRODUCT */
app.put("/update-product/:id", async (req,res)=>{

try{

await Product.findByIdAndUpdate(req.params.id,{
name:req.body.name,
price:req.body.price
});

res.json({message:"Updated ✔"});

}catch(err){
console.log(err);
res.status(500).json({message:"Update failed"});
}

});

/* DELETE PRODUCT */
app.delete("/delete-product/:id", async (req,res)=>{

try{

await Product.findByIdAndDelete(req.params.id);

res.json({message:"Deleted ✔"});

}catch(err){
console.log(err);
res.status(500).json({message:"Delete failed"});
}

});

/* =========================
   ORDER + EMAIL (DEBUGGED)
========================= */
app.post("/order", async (req,res)=>{

try{

console.log("🔥 ORDER ROUTE HIT");
console.log(req.body);

/* VALIDATION */
if(!req.body.email){
return res.status(400).json({message:"Email missing"});
}

/* SAVE ORDER */
const order = new Order(req.body);
await order.save();

console.log("📦 Order saved");

/* EMAIL START */
console.log("📨 Preparing email...");

const mailOptions = {
from:"Malone Store <YOUR_GMAIL@gmail.com>",
to:req.body.email,
subject:"🛒 Order Confirmation - Malone Store",
html:`
<h2>Thank you for your order 🎉</h2>

<p><b>Name:</b> ${req.body.fullName}</p>
<p><b>Phone:</b> ${req.body.phone}</p>
<p><b>Location:</b> ${req.body.location}</p>

<h3>Items:</h3>
<ul>
${req.body.items.map(i=>`<li>${i.name} - KES ${i.price}</li>`).join("")}
</ul>

<p>Status: Pending</p>
<hr>
<p>We will contact you soon 🚚</p>
`
};

/* SEND EMAIL */
let info = await transporter.sendMail(mailOptions);

console.log("✅ EMAIL SENT SUCCESSFULLY");
console.log("ID:", info.messageId);

res.json({message:"Order placed + email sent ✔"});

}catch(err){

console.log("❌ ORDER ERROR:", err);

res.status(500).json({message:"Order failed"});

}

});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("🚀 Server running on port " + PORT);
});
