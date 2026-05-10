const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(__dirname));

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
res.send("🚀 SERVER RUNNING");
});

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("MongoDB Connected ✔"))
.catch(err => console.log("DB ERROR:", err));

const Order = mongoose.model("Order", {
orderId: String,
phone: String,
items: Array,
total: Number,
status: { type: String, default: "Pending" },
date: { type: Date, default: Date.now }
});

/* ================= SASAPAY PAYMENT ================= */
app.post("/sasapay/pay", async (req, res) => {

try {

const { phone, total, items } = req.body;

console.log("🚀 PAYMENT START");
console.log("📱 Phone:", phone);
console.log("💰 Amount:", total);

/* ================= ENV CHECK ================= */
console.log("ENV STATUS:", {
client: process.env.SASAPAY_CLIENT_ID ? "OK" : "MISSING",
secret: process.env.SASAPAY_CLIENT_SECRET ? "OK" : "MISSING",
merchant: process.env.SASAPAY_MERCHANT_CODE ? "OK" : "MISSING"
});

/* ================= 1. GET TOKEN ================= */
const tokenRes = await axios({
method: "POST",
url: "https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
auth: {
username: process.env.SASAPAY_CLIENT_ID,
password: process.env.SASAPAY_CLIENT_SECRET
},
headers: {
"Content-Type": "application/json"
}
});

console.log("🔑 TOKEN RESPONSE:", tokenRes.data);

/* support both formats */
const token =
tokenRes.data.access_token ||
tokenRes.data.token;

if (!token) {
throw new Error("No token returned from SasaPay");
}

/* ================= 2. CREATE ORDER ================= */
const orderId = "ORDER_" + Date.now();

/* ================= 3. REQUEST PAYMENT ================= */
const paymentRes = await axios({
method: "POST",
url: "https://sandbox.sasapay.app/api/v1/payments/request-payment/",
data: {
MerchantCode: process.env.SASAPAY_MERCHANT_CODE,
PhoneNumber: phone,
Amount: total,
Currency: "KES",
TransactionReference: orderId,
CallBackURL: "https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
},
headers: {
Authorization: `Bearer ${token}`,
"Content-Type": "application/json"
}
});

console.log("💳 PAYMENT RESPONSE:", paymentRes.data);

/* ================= SAVE ORDER ================= */
await Order.create({
orderId,
phone,
items,
total,
status: "Pending"
});

/* ================= RESPONSE ================= */
return res.json({
success: true,
data: paymentRes.data
});

} catch (err) {

console.log("🔥 SASAPAY ERROR START");
console.log(err.response?.data || err.message);
console.log("🔥 SASAPAY ERROR END");

return res.status(500).json({
error: "Payment failed",
details: err.response?.data || err.message
});

}

});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req, res) => {

try {

console.log("📩 CALLBACK RECEIVED:", req.body);

const status = req.body?.status;
const orderId = req.body?.TransactionReference;

if (status === "Success") {

await Order.findOneAndUpdate(
{ orderId },
{ status: "Paid" }
);

return res.redirect("/confirm.html?orderId=" + orderId);

}

/* FAILED */
await Order.findOneAndUpdate(
{ orderId },
{ status: "Failed" }
);

return res.redirect("/failed.html");

} catch (err) {

console.log("CALLBACK ERROR:", err);

return res.redirect("/failed.html");

}

});

/* ================= HTML ROUTES ================= */
app.get("/confirm.html", (req, res) => {
res.sendFile(path.join(__dirname, "confirm.html"));
});

app.get("/failed.html", (req, res) => {
res.sendFile(path.join(__dirname, "failed.html"));
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("🚀 SERVER RUNNING ON PORT", PORT);
});
