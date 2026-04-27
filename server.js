const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* DB */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB connected ✔"))
.catch(err=>console.log(err));

/* MODELS */
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

/* MULTER (CLEAN) */
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
limits:{fileSize:5 * 1024 * 1024} // 5MB safety
});

/* PRODUCTS */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

app.post("/add-product-upload", upload.single("image"), async (req,res)=>{

const product = new Product({
name:req.body.name || "Unnamed",
price:req.body.price || 0,
image:req.file ? req.file.filename : ""
});

await product.save();
res.json(product);

});

/* SAFE DELETE */
app.delete("/delete-product/:id", async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({message:"deleted"});
});

/* AUTH CLEAN */
const JWT_SECRET = "secret123";

app.post("/signup", async (req,res)=>{
try{

const hash = await bcrypt.hash(req.body.password,10);

await new User({
name:req.body.name,
email:req.body.email,
password:hash
}).save();

res.json({message:"created"});

}catch(err){
res.status(400).json({message:"exists"});
}
});

app.post("/login", async (req,res)=>{

const user = await User.findOne({email:req.body.email});

if(!user) return res.json({message:"User not found"});

const ok = await bcrypt.compare(req.body.password,user.password);

if(!ok) return res.json({message:"Wrong password"});

const token = jwt.sign({id:user._id},JWT_SECRET);

res.json({token,user});
});

/* SERVER */
const PORT = process.env.PORT || 10000;
app.listen(PORT,()=>console.log("Running "+PORT));
