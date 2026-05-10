const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✔ DB Connected"))
  .catch(err => console.log("DB ERROR:", err));

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

/* ================= SIMPLE ADMIN AUTH ================= */
const ADMIN_TOKEN = "ADMIN_TOKEN_123";

function verify(req, res, next) {
  const token = req.headers.authorization;
  if (token === "Bearer " + ADMIN_TOKEN) return next();
  return res.status(403).json({ error: "Unauthorized" });
}

/* ================= ADMIN LOGIN ================= */
app.post("/admin-login", (req, res) => {
  const { email, password } = req.body;

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ token: ADMIN_TOKEN });
  }

  return res.status(401).json({ error: "Invalid login" });
});

/* ================= PRODUCTS ================= */
app.get("/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post("/products", verify, async (req, res) => {
  const { name, price, image } = req.body;
  const product = await Product.create({ name, price, image });
  res.json(product);
});

app.put("/product/:id", verify, async (req, res) => {
  await Product.findByIdAndUpdate(req.params.id, req.body);
  res.json({ success: true });
});

app.delete("/product/:id", verify, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ================= ORDERS ================= */
app.get("/orders", verify, async (req, res) => {
  const orders = await Order.find().sort({ date: -1 });
  res.json(orders);
});

/* ================= SASAPAY PAYMENT ================= */
app.post("/sasapay/pay", async (req, res) => {

  try {

    const { phone, total, items } = req.body;

    const credentials = Buffer.from(
      `${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await axios({
      method: "GET",
      url: "https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${credentials}`
      }
    });

    const token = tokenRes.data.access_token;

    const orderId = "ORDER_" + Date.now();

    await Order.create({
      orderId,
      phone,
      items,
      total,
      status: "Pending"
    });

    const paymentRes = await axios({
      method: "POST",
      url: "https://sandbox.sasapay.app/api/v1/payments/request-payment/",
      data: {
        MerchantCode: process.env.SASAPAY_MERCHANT_CODE,
        NetworkCode: "63902",
        PhoneNumber: phone,
        TransactionReference: orderId,
        AccountReference: orderId,
        Currency: "KES",
        Amount: total,
        TransactionDesc: "Checkout Payment",
        CallBackURL: "https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
      },
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    res.json({
      success: true,
      orderId,
      data: paymentRes.data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }

});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req, res) => {

  const orderId =
    req.body?.TransactionReference ||
    req.body?.transaction_reference;

  const status = req.body?.status;

  if (status === "Success") {
    await Order.findOneAndUpdate({ orderId }, { status: "Paid" });
  } else {
    await Order.findOneAndUpdate({ orderId }, { status: "Failed" });
  }

  res.sendStatus(200);
});

/* ================= ORDER STATUS (FOR FRONTEND) ================= */
app.get("/order-status", async (req, res) => {

  const order = await Order.findOne({ orderId: req.query.orderId });

  if (!order) return res.json({ status: "NotFound" });

  res.json({ status: order.status });

});

/* ================= AUTO FAIL AFTER 10s ================= */
setInterval(async () => {

  await Order.updateMany(
    {
      status: "Pending",
      date: { $lt: new Date(Date.now() - 10000) }
    },
    { status: "Failed" }
  );

}, 5000);

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING ON PORT", PORT);
});
