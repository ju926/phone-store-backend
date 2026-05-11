require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");

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

/* ================= MODELS ================= */
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

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
console.log("Client connected:", socket.id);
});

/* ================= SASAPAY PAY ================= */
app.post("/sasapay/pay", async (req, res) => {
try {

const { phone, email, total, items } = req.body;

const credentials = Buffer.from(
`${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
).toString("base64");

const tokenRes = await axios.get(
"https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
{
headers: { Authorization: `Basic ${credentials}` }
}
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

/* LIVE NEW ORDER */
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

res.json({
success: true,
orderId
});

} catch (err) {
console.log(err.message);
res.status(500).json({ success: false });
}
});

/* ================= CALLBACK (ENTERPRISE FIXED) ================= */
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

const status = (statusRaw || "").toString().toLowerCase();

const order = await Order.findOne({ orderId });

if (!order) return res.sendStatus(200);

/* ================= SUCCESS ================= */
if (
status.includes("success") ||
status.includes("0") ||
status.includes("completed")
) {

order.status = "Paid";
await order.save();

/* EMAIL SUCCESS */
if (order.email) {
await transporter.sendMail({
from: process.env.EMAIL_USER,
to: order.email,
subject: "✅ Payment Successful - Malone Store",
html: `
<h2 style="color:green">Payment Successful</h2>
<p><b>Order ID:</b> ${order.orderId}</p>
<p><b>Amount:</b> KES ${order.total}</p>
<p>Status: PAID</p>
`
});
}

/* LIVE UPDATE */
io.emit("order-update", {
orderId: order.orderId,
status: "Paid"
});

return res.sendStatus(200);
}

/* ================= FAILED ================= */

order.status = "Failed";
await order.save();

/* EMAIL FAILED */
if (order.email) {
await transporter.sendMail({
from: process.env.EMAIL_USER,
to: order.email,
subject: "❌ Payment Failed - Malone Store",
html: `
<h2 style="color:red">Payment Failed</h2>
<p><b>Order ID:</b> ${order.orderId}</p>
<p><b>Amount:</b> KES ${order.total}</p>
<p>Status: FAILED</p>
`
});
}

/* LIVE UPDATE */
io.emit("order-update", {
orderId: order.orderId,
status: "Failed"
});

return res.sendStatus(200);

} catch (err) {
console.log("CALLBACK ERROR:", err);
return res.sendStatus(500);
}
});

/* ================= STATUS API ================= */
app.get("/order-status", async (req, res) => {

const order = await Order.findOne({ orderId: req.query.orderId });

if (!order) return res.json({ status: "NotFound" });

let status = order.status.toLowerCase();

if (status === "paid") status = "success";
if (status === "failed") status = "failed";

res.json({ status });

});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
console.log("🚀 Server running on port", PORT);
});
