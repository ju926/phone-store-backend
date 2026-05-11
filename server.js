require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("✔ MongoDB Connected"))
.catch(err => console.log(err));

/* ================= CLOUDINARY ================= */
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
cloudinary,
params: {
folder: "products",
allowed_formats: ["jpg", "png", "jpeg", "webp"]
}
});

const upload = multer({ storage });

/* ================= MODELS ================= */
const Product = mongoose.model("Product", {
name: String,
price: Number,
image: String,
date: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", {
orderId: String,
phone: String,
email: String,
items: Array,
total: Number,
status: { type: String, default: "Pending" },
date: { type: Date, default: Date.now }
});

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}
});

/* ================= ADMIN ================= */
const ADMIN_TOKEN = "ADMIN_TOKEN_123";

function verify(req, res, next) {
if (req.headers.authorization === "Bearer " + ADMIN_TOKEN) return next();
return res.status(403).json({ error: "Unauthorized" });
}

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
console.log("Client connected");
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req, res) => {
const products = await Product.find();
res.json(products);
});

app.post("/products", verify, upload.single("image"), async (req, res) => {
const product = await Product.create({
name: req.body.name,
price: req.body.price,
image: req.file.path
});
res.json(product);
});

/* ================= ORDERS ================= */
app.get("/orders", verify, async (req, res) => {
const orders = await Order.find().sort({ date: -1 });
res.json(orders);
});

/* 🔥 FIXED DELETE ORDER (THIS WAS MISSING) */
app.delete("/order/:id", verify, async (req, res) => {
await Order.findByIdAndDelete(req.params.id);
res.json({ success: true });
});

/* ================= SASAPAY PAYMENT ================= */
app.post("/sasapay/pay", async (req, res) => {
try {

const { phone, email, total, items } = req.body;

const credentials = Buffer.from(
`${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
).toString("base64");

const tokenRes = await axios.get(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{ headers: { Authorization: `Basic ${credentials}` } }
);

const token = tokenRes.data.access_token;

const orderId = "ORDER_" + Date.now();

const order = await Order.create({
orderId,
phone,
email,
items,
total,
status: "Pending"
});

io.emit("new-order", order);

await axios.post(
"https://sandbox.sasapay.app/api/v1/payments/request-payment/",
{
MerchantCode: process.env.SASAPAY_MERCHANT_CODE,
NetworkCode: "63902",
PhoneNumber: phone,
TransactionReference: orderId,
AccountReference: orderId,
Currency: "KES",
Amount: total,
TransactionDesc: "Store Payment",
CallBackURL: process.env.CALLBACK_URL
},
{
headers: {
Authorization: `Bearer ${token}`,
"Content-Type": "application/json"
}
}
);

res.json({ success: true, orderId });

} catch (err) {
res.status(500).json({ success: false });
}
});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req, res) => {
try {

const orderId = req.body.TransactionReference || req.body.transactionReference;
const statusRaw = (req.body.status || req.body.ResultCode || "").toString();

let status = "Failed";

if (
statusRaw.includes("success") ||
statusRaw.includes("0") ||
statusRaw.includes("completed")
) {
status = "Paid";

const order = await Order.findOneAndUpdate(
{ orderId },
{ status: "Paid" },
{ new: true }
);

if (order?.email) {
await transporter.sendMail({
from: process.env.EMAIL_USER,
to: order.email,
subject: "Payment Successful ✔",
html: `<h2>Payment Successful</h2><p>KES ${order.total}</p>`
});
}

io.emit("order-update", { orderId, status: "Paid" });
return res.sendStatus(200);
}

/* FAILED FLOW */
const order = await Order.findOneAndUpdate(
{ orderId },
{ status: "Failed" },
{ new: true }
);

if (order?.email) {
await transporter.sendMail({
from: process.env.EMAIL_USER,
to: order.email,
subject: "Payment Failed ❌",
html: `<h2>Payment Failed</h2><p>Try again.</p>`
});
}

io.emit("order-update", { orderId, status: "Failed" });

res.sendStatus(200);

} catch (err) {
res.sendStatus(500);
}
});

/* ================= STATUS ================= */
app.get("/order-status", async (req, res) => {
const order = await Order.findOne({ orderId: req.query.orderId });
if (!order) return res.json({ status: "NotFound" });

res.json({ status: order.status.toLowerCase() });
});

/* ================= AUTO FAIL ================= */
setInterval(async () => {
const timeout = new Date(Date.now() - 2 * 60 * 1000);

await Order.updateMany(
{ status: "Pending", date: { $lt: timeout } },
{ status: "Failed" }
);

}, 15000);

/* ================= START ================= */
server.listen(process.env.PORT || 10000, () => {
console.log("🚀 Server running");
});
