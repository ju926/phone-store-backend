const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* =========================
   MONGODB CONNECTION
========================= */

mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("MongoDB connected ✔"))
.catch(err => console.log("DB error:", err));

/* =========================
   SCHEMAS
========================= */

const ProductSchema = new mongoose.Schema({
name: String,
price: String,
image: String
});

const OrderSchema = new mongoose.Schema({
name: String,
phone: String,
email: String,
amount: String,
cart: Array,
status: { type: String, default: "pending" }
});

const Product = mongoose.model("Product", ProductSchema);
const Order = mongoose.model("Order", OrderSchema);

/* =========================
   EMAIL SETUP
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

/* GET */
app.get("/products", async (req, res) => {
const products = await Product.find();
res.json(products);
});

/* ADD */
app.post("/add-product", async (req, res) => {

const product = new Product({
name: (req.body.name || "").trim() || "Product",
price: req.body.price || 0,
image: req.body.image || ""
});

await product.save();

res.json(product);

});

/* UPDATE */
app.put("/update-product/:id", async (req, res) => {

await Product.findByIdAndUpdate(req.params.id, {
name: req.body.name,
price: req.body.price,
image: req.body.image
});

res.json({ message: "Updated" });

});

/* DELETE */
app.delete("/delete-product/:id", async (req, res) => {

await Product.findByIdAndDelete(req.params.id);

res.json({ message: "Deleted" });

});

/* =========================
   ORDER + EMAIL
========================= */

app.post("/order", async (req, res) => {

const order = new Order(req.body);
await order.save();

/* EMAIL CUSTOMER */
try {
await transporter.sendMail({
from: "Store <buanakwenda@gmail.com>",
to: req.body.email,
subject: "🛒 Order Confirmation",
html: `
<h2>🎉 Order Received</h2>
<p><b>Name:</b> ${req.body.name}</p>
<p><b>Total:</b> ${req.body.amount} KES</p>
<p>Status: Pending</p>
<hr>
<p>Thank you for shopping with us ❤️</p>
`
});
} catch (err) {
console.log(err);
}

res.json(order);

});

/* =========================
   ORDERS
========================= */

app.get("/orders", async (req, res) => {
const orders = await Order.find();
res.json(orders);
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});
