const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* =========================
   MONGODB
========================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(()=>console.log("MongoDB connected ✔"))
.catch(err=>console.log(err));

/* =========================
   MODELS
========================= */

const User = mongoose.model("User",{
name:String,
email:{type:String,unique:true},
password:String,
role:{type:String,default:"user"}
});

/* =========================
   AUTH KEY
========================= */
const JWT_SECRET = "malone_secret_key";

/* =========================
   SIGNUP
========================= */
app.post("/signup", async (req,res)=>{

const {name,email,password} = req.body;

try{

const hashed = await bcrypt.hash(password,10);

const user = new User({
name,
email,
password:hashed
});

await user.save();

res.json({message:"Account created ✔"});

}catch(err){
res.status(400).json({message:"User already exists"});
}

});

/* =========================
   LOGIN
========================= */
app.post("/login", async (req,res)=>{

const {email,password} = req.body;

const user = await User.findOne({email});

if(!user){
return res.status(400).json({message:"User not found"});
}

const check = await bcrypt.compare(password,user.password);

if(!check){
return res.status(400).json({message:"Wrong password"});
}

const token = jwt.sign(
{id:user._id,role:user.role},
JWT_SECRET,
{expiresIn:"7d"}
);

res.json({
message:"Login success ✔",
token,
user
});

});

/* =========================
   MIDDLEWARE (PROTECT)
========================= */
function auth(req,res,next){

const token = req.headers.authorization;

if(!token) return res.status(401).json({message:"No token"});

try{

const verified = jwt.verify(token.replace("Bearer ",""),JWT_SECRET);
req.user = verified;

next();

}catch(err){
res.status(401).json({message:"Invalid token"});
}

}

/* =========================
   EXAMPLE PROTECTED ROUTE
========================= */
app.get("/profile", auth, async (req,res)=>{
const user = await User.findById(req.user.id);
res.json(user);
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT,()=>{
console.log("Server running on "+PORT);
});
