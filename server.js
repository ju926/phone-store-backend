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
const io = new Server(server, {
cors: { origin: "*" }
});

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
name: { type: String, required: true },
price: { type: Number, required: true },
image: { type: String, required: true },
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
if (req.headers.authorization === "Bearer " + ADMIN_TOKEN) {
return next();
}
return res.status(403).json({ error: "Unauthorized" });
}

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
console.log("Client connected:", socket.id);
});

/* ================= PRODUCTS ================= */

/* GET PRODUCTS */
app.get("/products", async (req, res) => {
const products = await Product.find();

res.json(products.map(p => ({
_id: p._id,
name: p.name,
price: Number(p.price || 0),
image: p.image || "https://via.placeholder.com/300"
})));
});

/* CREATE PRODUCT */
app.post("/products", verify, upload.single("image"), async (req, res) => {
try {

if (!req.file) {
return res.status(400).json({ error: "Image required" });
}

const product = await Product.create({
name: req.body.name,
price: Number(req.body.price),
image: req.file.path
});

res.json({ success: true, product });

} catch (err) {
console.log(err);
res.status(500).json({ error: "Server error" });
}
});

/* ================= ORDERS ================= */
app.get("/orders", verify, async (req, res) => {
const orders = await Order.find().sort({ date: -1 });
res.json(orders);
});

/* ================= PAYMENT ================= */
app.post("/sasapay/pay", async (req, res) => {
try {

const { phone, email, total, items } = req.body;

const credentials = Buffer.from(
`${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
).toString("base64");

const tokenRes = await axios.get(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{
headers: {
Authorization: `Basic ${credentials}`
}
}
);

const token = tokenRes.data.access_token;

const orderId = "ORDER_" + Date.now();

const order = await Order.create({
orderId,
phone,
email,
items,
total: Number(total),
status: "Pending"
});

io.emit("new-order", order);

const paymentRes = await axios.post(
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

res.json({
success: true,
orderId,
checkoutRequestID: paymentRes.data?.CheckoutRequestID || orderId
});

} catch (err) {
console.log(err.response?.data || err.message);
res.status(500).json({ success: false, error: err.message });
}
});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req, res) => {
try {

const orderId =
req.body?.TransactionReference ||
req.body?.transactionReference ||
req.body?.transaction_reference ||
req.body?.OrderID;

const statusRaw =
req.body?.status ||
req.body?.Status ||
req.body?.ResultCode;

let status = (statusRaw || "").toString().toLowerCase();

/* SUCCESS */
if (
status.includes("success") ||
status.includes("0") ||
status.includes("completed")
) {

const order = await Order.findOneAndUpdate(
{ orderId },
{ status: "Paid" },
{ new: true }
);

/* EMAIL SUCCESS */
if (order?.email) {
await transporter.sendMail({
from: process.env.EMAIL_USER,
to: order.email,
subject: "Payment Successful ✔",
html: `
<h2>Payment Successful</h2>
<p>Order ID: ${order.orderId}</p>
<p>Amount: KES ${order.total}</p>
<p>Status: PAID</p>
`
});
}

io.emit("order-update", { orderId, status: "Paid" });

return res.sendStatus(200);
}

/* FAILED */
const failedOrder = await Order.findOneAndUpdate(
{ orderId },
{ status: "Failed" },
{ new: true }
);

/* EMAIL FAILED */
if (failedOrder?.email) {
await transporter.sendMail({
from: process.env.EMAIL_USER,
to: failedOrder.email,
subject: "Payment Failed ❌",
html: `
<h2>Payment Failed</h2>
<p>Order ID: ${failedOrder.orderId}</p>
<p>Amount: KES ${failedOrder.total}</p>
<p>Status: FAILED</p>
`
});
}

io.emit("order-update", { orderId, status: "Failed" });

return res.sendStatus(200);

} catch (err) {
console.log("CALLBACK ERROR:", err);
return res.sendStatus(500);
}
});

/* ================= ORDER STATUS ================= */
app.get("/order-status", async (req, res) => {
const order = await Order.findOne({ orderId: req.query.orderId });

if (!order) return res.json({ status: "NotFound" });

res.json({
status: order.status.toLowerCase()
});
});

/* ================= AUTO FAIL ================= */
setInterval(async () => {
const timeout = new Date(Date.now() - 2 * 60 * 1000);

await Order.updateMany(
{
status: "Pending",
date: { $lt: timeout }
},
{ status: "Failed" }
);

}, 15000);

/* ================= START ================= */
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
console.log("🚀 Server running on port", PORT);
});
