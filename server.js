const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // IMPORTANT for image uploads

/* =========================
   DATABASE (TEMP MEMORY)
========================= */

let products = [];
let orders = [];

/* =========================
   EMAIL SETUP
========================= */

const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: "buanakwenda@gmail.com",
pass: "YOUR_APP_PASSWORD"
}
});

/* =========================
   PRODUCTS API
========================= */

// Get all products
app.get("/products", (req, res) => {
res.json(products);
});

// Add product (ADMIN MULTI UPLOAD SUPPORT)
app.post("/add-product", (req, res) => {

const product = {
id: Date.now(),
name: req.body.name,
price: req.body.price,
image: req.body.image // base64 image from admin
};

products.push(product);

res.json({
message: "Product added successfully",
product
});

});

// Delete product (optional admin feature)
app.delete("/delete-product/:id", (req, res) => {

products = products.filter(p => p.id != req.params.id);

res.json({ message: "Product deleted" });

});

/* =========================
   ORDER SYSTEM + EMAIL
========================= */

app.post("/order", (req, res) => {

const order = {
id: Date.now(),
name: req.body.name,
phone: req.body.phone,
email: req.body.email,
amount: req.body.amount,
cart: req.body.cart,
status: "pending"
};

orders.push(order);

/* EMAIL CONTENT */
const mailOptions = {
from: "Malone Store <buanakwenda@gmail.com>",
to: req.body.email,
subject: "🛒 Order Confirmation - Malone Store",
html: `
<h2>🎉 Thank you for your order</h2>

<p><b>Name:</b> ${req.body.name}</p>
<p><b>Phone:</b> ${req.body.phone}</p>
<p><b>Total:</b> ${req.body.amount} KES</p>

<h3>Status: Pending</h3>

<p>We will contact you for delivery 🚚</p>

<hr>
<p>Thank you for shopping with Malone Store ❤️</p>
`
};

/* SEND EMAIL */
transporter.sendMail(mailOptions, (err, info) => {
if (err) {
console.log("Email error:", err);
} else {
console.log("Email sent:", info.response);
}
});

res.json({
message: "Order placed successfully",
order
});

});

/* =========================
   GET ORDERS (ADMIN)
========================= */

app.get("/orders", (req, res) => {
res.json(orders);
});

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});
