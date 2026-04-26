const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= CREATE UPLOADS FOLDER ================= */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use("/uploads", express.static("uploads"));

/* ================= MEMORY DATABASE ================= */
let products = [];
let orders = [];

/* ================= MULTER CONFIG ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ================= PRODUCTS ================= */

// GET PRODUCTS
app.get("/products", (req, res) => {
  res.json(products);
});

// ADD PRODUCT
app.post("/add-product", upload.single("image"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  let product = {
    id: Date.now(),
    name: req.body.name,
    price: req.body.price,
    image: `/uploads/${req.file.filename}`
  };

  products.push(product);

  res.json({
    message: "Product added",
    product
  });
});

// DELETE PRODUCT
app.post("/delete-product", (req, res) => {
  products = products.filter(p => p.id !== req.body.id);
  res.json({ message: "Deleted" });
});

/* ================= ORDERS ================= */

// GET ORDERS
app.get("/orders", (req, res) => {
  res.json(orders);
});

// CREATE ORDER
app.post("/order", (req, res) => {

  let order = {
    id: Date.now(),
    name: req.body.name,
    phone: req.body.phone,
    amount: req.body.amount,
    cart: req.body.cart,
    status: "pending",
    tracking: "Order placed"
  };

  orders.push(order);

  res.json({
    message: "Order created",
    order
  });
});

// UPDATE ORDER STATUS
app.post("/order-status", (req, res) => {

  let order = orders.find(o => o.id === req.body.id);

  if (order) {
    order.status = req.body.status;
  }

  res.json({ message: "Status updated" });
});

// UPDATE TRACKING
app.post("/tracking", (req, res) => {

  let order = orders.find(o => o.id === req.body.id);

  if (order) {
    order.tracking = req.body.tracking;
  }

  res.json({ message: "Tracking updated" });
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
