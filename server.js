const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

/* SERVE UPLOADS */
app.use("/uploads", express.static("uploads"));

/* =========================
   MONGODB CONNECTION
========================= */

mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store?retryWrites=true&w=majority")
.then(()=>console.log("MongoDB connected ✔"))
.catch(err=>console.log("DB error:",err));

/* =========================
   MODELS
========================= */

const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String
});

const Order = mongoose.model("Order",{
name:String,
phone:String,
email:String,
amount:Number,
location:String,
cart:Array,
status:{type:String,default:"pending"}
});

/* =========================
   EMAIL SETUP
========================= */

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"buanakwenda@gmail.com",
pass:"YOUR_APP_PASSWORD"
}
});

/* =========================
   FILE UPLOAD (MULTER)
========================= */

const storage = multer.diskStorage({
destination:"uploads/",
filename:(req,file,cb)=>{
cb(null,Date.now() + path.extname(file.originalname));
}
});

const upload = multer({storage});

/* =========================
   PRODUCTS API
========================= */

/* GET PRODUCTS */
app.get("/products", async (req,res)=>{
const products = await Product.find();
res.json(products);
});

/* ADD PRODUCT (UPLOAD IMAGE) */
app.post("/add-product-upload", upload.single("image"), async (req,res)=>{

const product = new Product({
name:req.body.name || "Unnamed",
price:req.body.price || 0,
image:req.file ? req.file.filename : ""
});

await product.save();

res.json(product);
});

/* UPDATE PRODUCT (WITH IMAGE) */
app.put("/update-product-upload/:id", upload.single("image"), async (req,res)=>{

let updateData = {
name:req.body.name,
price:req.body.price
};

if(req.file){
updateData.image = req.file.filename;
}

await Product.findByIdAndUpdate(req.params.id, updateData);

res.json({message:"updated"});
});

/* DELETE PRODUCT */
app.delete("/delete-product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"deleted"});
});

/* =========================
   ORDERS API
========================= */

app.post("/order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

/* EMAIL TO CUSTOMER */
const mailOptions = {
from:"Store <buanakwenda@gmail.com>",
to:req.body.email,
subject:"🛒 Order Confirmation",
html:`
<h2>Order Received ✔</h2>
<p>Name: ${req.body.name}</p>
<p>Phone: ${req.body.phone}</p>
<p>Total: ${req.body.amount}</p>
<p>Status: Pending</p>
`
};

try{
await transporter.sendMail(mailOptions);
console.log("Email sent ✔");
}catch(err){
console.log("Email error ❌",err);
}

res.json(order);

});

/* GET ORDERS (ADMIN) */
app.get("/orders", async (req,res)=>{
const orders = await Order.find();
res.json(orders);
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, ()=>{
console.log("Server running on port " + PORT);
});
