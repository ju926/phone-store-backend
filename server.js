const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // IMPORTANT for images

/* =========================
   IN-MEMORY DATABASE
========================= */

let products = [];
let orders = [];

/* =========================
   EMAIL SETUP (GMAIL)
========================= */

const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: "buanakwenda@gmail.com",
pass: "ydzw pgya mkqs okwe"
}
});

/* =========================
   PRODUCTS API
========================= */

/* GET PRODUCTS */
app.get("/products", (req, res) => {
res.json(products);
});

/* ADD PRODUCT (ADMIN MULTI UPLOAD SUPPORT) */
app.post("/add-product", (req, res) => {

const product = {
id: Date.now(),
name: req.body.name,
price: req.body.price,
image: req.body.image
};

products.push(product);

res.json({
message: "Product added successfully",
product
});

});

/* UPDATE PRODUCT (ADMIN EDIT) */
app.put("/update-product/:id", (req, res) => {

let product = products.find(p => p.id == req.params.id);

if (!product) {
return res.status(404).json({ message: "Product not found" });
}

product.name = req.body.name;
product.price = req.body.price;
product.image = req.body.image;

res.json({
message: "Product updated successfully",
product
});

});

/* DELETE PRODUCT (ADMIN) */
app.delete("/delete-product/:id", (req, res) => {

products = products.filter(p => p.id != req.params.id);

res.json({ message: "Product deleted successfully" });

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
<h2>🎉 Order Received Successfully</h2>

<p><b>Name:</b> ${req.body.name}</p>
<p><b>Phone:</b> ${req.body.phone}</p>
<p><b>Total:</b> ${req.body.amount} KES</p>

<h3>Status: Pending</h3>

<p>We will contact you soon for delivery 🚚</p>

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
