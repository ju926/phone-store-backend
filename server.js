const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* =========================
   CREATE UPLOAD FOLDER (RENDER SAFE)
========================= */
if (!fs.existsSync("uploads")) {
fs.mkdirSync("uploads");
}

/* =========================
   MONGODB CONNECTION
========================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(() => console.log("MongoDB Connected ✔"))
.catch(err => console.log("DB Error:", err));

/* =========================
   PRODUCT MODEL
========================= */
const Product = mongoose.model("Product", {
name: String,
price: Number,
image: String
});

/* =========================
   ORDER MODEL
========================= */
const Order = mongoose.model("Order", {
fullName: String,
phone: String,
email: String,
location: String,
items: Array,
date: { type: Date, default: Date.now }
});

/* =========================
   MULTER CONFIG
========================= */
const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, "uploads/");
},
filename: (req, file, cb) => {
cb(null, Date.now() + path.extname(file.originalname));
}
});

const upload = multer({ storage });

/* =========================
   EMAIL SETUP
========================= */
const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: "YOUR_GMAIL@gmail.com",
pass: "YOUR_APP_PASSWORD"
}
});

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
res.send("Store API Running ✔");
});

/* =========================
   PRODUCTS
========================= */
app.get("/products", async (req, res) => {
const products = await Product.find();
res.json(products);
});

/* ADD PRODUCT */
app.post("/add-product-upload", upload.single("image"), async (req, res) => {

try {

console.log("BODY:", req.body);
console.log("FILE:", req.file);

if (!req.file) {
return res.status(400).json({ message: "No image uploaded" });
}

const product = new Product({
name: req.body.name,
price: req.body.price,
image: req.file.filename
});

await product.save();

res.json(product);

} catch (err) {
console.log("UPLOAD ERROR:", err);
res.status(500).json({ message: "Upload failed" });
}

});

/* DELETE PRODUCT */
app.delete("/delete-product/:id", async (req, res) => {
await Product.findByIdAndDelete(req.params.id);
res.json({ message: "Deleted ✔" });
});

/* =========================
   PLACE ORDER + EMAIL
========================= */
app.post("/order", async (req, res) => {

try {

const order = new Order(req.body);
await order.save();

/* EMAIL */
const mailOptions = {
from: "Malone Store <YOUR_GMAIL@gmail.com>",
to: order.email,
subject: "🛒 Order Confirmation - Malone Store",
html: `
<h2>Thank you for your order 🎉</h2>

<p><b>Name:</b> ${order.fullName}</p>
<p><b>Phone:</b> ${order.phone}</p>
<p><b>Location:</b> ${order.location}</p>

<h3>Items:</h3>
<ul>
${order.items.map(i => `<li>${i.name} - KES ${i.price}</li>`).join("")}
</ul>

<p>Status: Pending</p>

<hr>
<p>We will contact you for delivery 🚚</p>
`
};

await transporter.sendMail(mailOptions);

console.log("Order email sent ✔");

res.json({ message: "Order placed + email sent ✔" });

} catch (err) {
console.log("ORDER ERROR:", err);
res.status(500).json({ message: "Order failed" });
}

});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});
