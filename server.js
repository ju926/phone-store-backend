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
  res.send("🚀 SERVER RUNNING SUCCESSFULLY");
});

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✔ MongoDB Connected"))
  .catch(err => console.log("❌ DB ERROR:", err));

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

    console.log("\n🚀 PAYMENT START");
    console.log("📱 Phone:", phone);
    console.log("💰 Amount:", total);

    /* ================= TOKEN ================= */
    const credentials = Buffer.from(
      `${process.env.SASAPAY_CLIENT_ID}:${process.env.SASAPAY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await axios({
      method: "GET",
      url: "https://sandbox.sasapay.app/api/v1/auth/token/?grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json"
      }
    });

    console.log("🔑 TOKEN RESPONSE:", tokenRes.data);

    const token = tokenRes.data.access_token;

    if (!token) {
      throw new Error("Token not received");
    }

    const orderId = "ORDER_" + Date.now();

    /* ================= PAYMENT REQUEST ================= */
    const payload = {
      MerchantCode: process.env.SASAPAY_MERCHANT_CODE,
      NetworkCode: "63902",
      PhoneNumber: phone,
      TransactionReference: orderId,
      AccountReference: orderId,
      Currency: "KES",
      Amount: total,
      TransactionDesc: "Phone Store Payment",
      CallBackURL: "https://phone-store-backend-9w7p.onrender.com/sasapay/callback"
    };

    console.log("📦 PAYMENT PAYLOAD:", payload);

    const paymentRes = await axios({
      method: "POST",
      url: "https://sandbox.sasapay.app/api/v1/payments/request-payment/",
      data: payload,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });

    console.log("💳 PAYMENT RESPONSE:", paymentRes.data);

    await Order.create({
      orderId,
      phone,
      items,
      total,
      status: "Pending"
    });

    return res.json({
      success: true,
      orderId,
      data: paymentRes.data
    });

  } catch (err) {

    console.log("\n🔥 SASAPAY ERROR DEBUG:");

    console.log("STATUS:", err.response?.status);
    console.log("DATA:", err.response?.data);
    console.log("MESSAGE:", err.message);

    return res.status(500).json({
      success: false,
      error: "Payment failed",
      details: err.response?.data || err.message
    });

  }

});

/* ================= CALLBACK ================= */
app.post("/sasapay/callback", async (req, res) => {

  try {

    console.log("📩 CALLBACK RECEIVED:", req.body);

    const orderId =
      req.body?.TransactionReference ||
      req.body?.transaction_reference;

    const status =
      req.body?.status;

    if (status === "Success" || status === "SUCCESS") {

      await Order.findOneAndUpdate(
        { orderId },
        { status: "Paid" }
      );

      return res.redirect("/confirm.html?orderId=" + orderId);
    }

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

/* ================= FRONTEND ROUTES ================= */
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
