const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* =========================
   DATABASE (IN MEMORY)
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
   PRODUCTS
========================= */

/* GET ALL PRODUCTS */
app.get("/products", (req, res) => {
res.json(products);
});

/* ADD PRODUCT (FIXED UNDEFINED ISSUE) */
app.post("/add-product", (req, res) => {

console.log("RECEIVED PRODUCT:", req.body);

const product = {
id: Date.now(),
name: (req.body.name || "").trim() || "Product",
price: req.body.price || 0,
image: req.body.image || ""
};

products.push(product);

res.json(product);

});

/* UPDATE PRODUCT */
app.put("/update-product/:id", (req, res) => {

let product = products.find(p => p.id == req.params.id);

if (!product) {
return res.status(404).json({ message: "Product not found" });
}

product.name = (req.body.name || "").trim();
product.price = req.body.price;
product.image = req.body.image;

res.json(product);

});

/* DELETE PRODUCT */
app.delete("/delete-product/:id", (req, res) => {

products = products.filter(p => p.id != req.params.id);

res.json({ message: "Deleted" });

});

/* =========================
   ORDER + EMAIL SYSTEM
========================= */

app.post("/order", async (req, res) => {

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

/* CUSTOMER EMAIL */
const mailOptions = {
from: "Store <buanakwenda@gmail.com>",
to: req.body.email,
subject: "🛒 Order Confirmation",
html: `
<h2>🎉 Order Received</h2>

<p><b>Name:</b> ${req.body.name}</p>
<p><b>Phone:</b> ${req.body.phone}</p>
<p><b>Total:</b> ${req.body.amount} KES</p>

<h3>Status: Pending</h3>

<p>We will contact you for delivery 🚚</p>

<hr>
<p>Thank you for shopping with us ❤️</p>
`
};

try {
await transporter.sendMail(mailOptions);
console.log("Email sent ✔");
} catch (err) {
console.log("Email error ❌", err);
}

res.json(order);

});

/* =========================
   GET ORDERS (OPTIONAL)
========================= */

app.get("/orders", (req, res) => {
res.json(orders);
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});
