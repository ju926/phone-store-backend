const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL);

/* ================= MODELS ================= */
const Product = mongoose.model("Product", {
name: String,
price: Number,
image: String
});

const Order = mongoose.model("Order", {
orderId: String,
phone: String,
items: Array,
total: Number,
status: { type: String, default: "Pending" },
date: { type: Date, default: Date.now }
});

/* ================= ADMIN LOGIN ================= */
app.post("/admin-login", (req, res) => {

const { email, password } = req.body;

if(
email === process.env.ADMIN_EMAIL &&
password === process.env.ADMIN_PASSWORD
){
return res.json({ token: "ADMIN_TOKEN_123" });
}

res.status(401).json({ error: "Login failed" });

});

/* ================= AUTH ================= */
function verify(req,res,next){

if(req.headers.authorization === "Bearer ADMIN_TOKEN_123"){
return next();
}

res.status(403).json({ error:"Unauthorized" });

}

/* ================= PRODUCTS ================= */
app.get("/products", async (req,res)=>{
res.json(await Product.find());
});

app.post("/products", verify, async (req,res)=>{
res.json(await Product.create(req.body));
});

app.put("/product/:id", verify, async (req,res)=>{
await Product.findByIdAndUpdate(req.params.id, req.body);
res.json({ success:true });
});

app.delete("/product/:id", verify, async (req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({ success:true });
});

/* ================= ORDERS ================= */
app.get("/orders", verify, async (req,res)=>{
res.json(await Order.find().sort({date:-1}));
});

/* ================= SASAPAY ================= */
app.post("/sasapay/pay", async (req,res)=>{

try{

const {phone,total,items} = req.body;

const credentials = Buffer.from(
`${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
).toString("base64");

const tokenRes = await axios.get(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{
headers:{ Authorization:`Basic ${credentials}` }
}
);

const token = tokenRes.data.access_token;

const orderId = "ORDER_" + Date.now();

await Order.create({
orderId,
phone,
items,
total,
status:"Pending"
});

const payment = await axios.post(
"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
{
MerchantCode:process.env.SASAPAY_MERCHANT_CODE,
NetworkCode:"63902",
PhoneNumber:phone,
TransactionReference:orderId,
AccountReference:orderId,
Currency:"KES",
Amount:total,
TransactionDesc:"Checkout",
CallBackURL:"https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
},
{
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
}
}
);

res.json({ success:true, orderId, data:payment.data });

}catch(err){
res.status(500).json({
success:false,
error:err.response?.data || err.message
});
}

});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req,res)=>{

const orderId =
req.body?.TransactionReference;

const status = req.body?.status;

await Order.findOneAndUpdate(
{orderId},
{status: status === "Success" ? "Paid" : "Failed"}
);

res.sendStatus(200);

});

/* ================= AUTO FAIL ================= */
setInterval(async ()=>{

await Order.updateMany(
{
status:"Pending",
date:{$lt:new Date(Date.now()-10000)}
},
{status:"Failed"}
);

},5000);

/* ================= START ================= */
app.listen(10000,()=>{
console.log("Server running");
});
