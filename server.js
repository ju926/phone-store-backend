const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* =========================
   DATABASE CONNECTION
========================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log("DB Error:", err));

/* =========================
   MODELS
========================= */
const Product = mongoose.model("Product",{
name:String,
price:Number,
image:String
});

const User = mongoose.model("User",{
name:String,
email:{type:String,unique:true},
password:String
});

/* =========================
   FILE UPLOAD (MULTER)
========================= */
const storage = multer.diskStorage({
destination:(req,file,cb)=>{
cb(null,"uploads/");
},
filename:(req,file,cb)=>{
cb(null, Date.now() + path.extname(file.originalname));
}
});

const upload = multer({
storage,
limits:{fileSize:5 * 1024 * 1024} // 5MB limit
});

/* =========================
   PRODUCTS API
========================= */

// GET PRODUCTS
app.get("/products", async (req,res)=>{
const products = await Product.find();
res.json(products);
});

// ADD PRODUCT
app.post("/add-product-upload", upload.single("image"), async (req,res)=>{

try{

const product = new Product({
name:req.body.name,
price:req.body.price,
image:req.file ? req.file.filename : ""
});

await product.save();

res.json(product);

}catch(err){
res.status(500).json({message:"Upload failed"});
}

});

// DELETE PRODUCT
app.delete("/delete-product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"Deleted"});
});

/* =========================
   AUTH SYSTEM
========================= */

const JWT_SECRET = "secret123";

/* SIGNUP */
app.post("/signup", async (req,res)=>{

try{

const hash = await bcrypt.hash(req.body.password,10);

const user = new User({
name:req.body.name,
email:req.body.email,
password:hash
});

await user.save();

res.json({message:"User created ✔"});

}catch(err){
res.status(400).json({message:"User already exists"});
}

});

/* LOGIN */
app.post("/login", async (req,res)=>{

const user = await User.findOne({email:req.body.email});

if(!user){
return res.json({message:"User not found"});
}

const match = await bcrypt.compare(req.body.password,user.password);

if(!match){
return res.json({message:"Wrong password"});
}

const token = jwt.sign({id:user._id},JWT_SECRET);

res.json({token,user});

});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});
