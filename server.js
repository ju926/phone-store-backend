const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= SAFE UPLOAD FOLDER ================= */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use("/uploads", express.static("uploads"));

/* ================= MEMORY STORAGE (TEMP DB) ================= */
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

// ADD PRODUCT (WITH IMAGE UPLOAD)
app.post("/add-product", upload.single("image"), (req, res) => {

  let product = {
    id: Date.now(),
    name: req.body.name,
    price: req.body.price,
    image: req.file ? `/uploads/${req.file.filename}` : ""
  };

  products.push(product);

  res.json(product);
});

// DELETE PRODUCT
app.post("/delete-product", (req, res) => {
  products = products.filter(p => p.id !== req.body.id);
  res.json({ success: true });
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
    location: req.body.location,
    status: "pending",
    tracking: "Order placed"
  };

  orders.push(order);

  res.json(order);
});

// UPDATE STATUS
app.post("/order-status", (req, res) => {

  let order = orders.find(o => o.id === req.body.id);

  if (order) {
    order.status = req.body.status;
  }

  res.json(order);
});

// UPDATE TRACKING
app.post("/tracking", (req, res) => {

  let order = orders.find(o => o.id === req.body.id);

  if (order) {
    order.tracking = req.body.tracking;
  }

  res.json(order);
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
