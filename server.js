const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

let orders = [];
let products = [];

/* EMAIL SETUP */
const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: "buanakwenda@gmail.com",
pass: "YOUR_NEW_APP_PASSWORD"
}
});

/* PRODUCTS */
app.get("/products", (req, res) => {
res.json(products);
});

/* ADD ORDER + EMAIL */
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

/* EMAIL */
const mailOptions = {
from: "Malone Store <buanakwenda@gmail.com>",
to: req.body.email,
subject: "🛒 Order Confirmation - Malone Store",
html: `
<h2>🎉 Order Received</h2>
<p><b>Name:</b> ${req.body.name}</p>
<p><b>Phone:</b> ${req.body.phone}</p>
<p><b>Total:</b> ${req.body.amount} KES</p>
<p>Status: Pending</p>
<hr>
<p>We will contact you soon 🚚</p>
`
};

transporter.sendMail(mailOptions, (err, info) => {
if (err) {
console.log("Email error:", err);
} else {
console.log("Email sent:", info.response);
}
});

res.json(order);

});

app.listen(10000, () => {
console.log("Server running on port 10000");
});
