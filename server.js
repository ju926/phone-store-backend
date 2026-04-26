const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= UPLOADS ================= */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use("/uploads", express.static("uploads"));

/* ================= DATABASE ================= */
let products = [];
let orders = [];

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

/* ================= PRODUCTS ================= */

app.get("/products", (req, res) => {
  res.json(products);
});

app.post("/add-product", upload.single("image"), (req, res) => {

  let product = {
    id: Date.now(),
    name: req.body.name,
    price: req.body.price,

    // ✅ FIXED IMAGE PATH (IMPORTANT)
    image: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
  };

  products.push(product);

  res.json(product);
});

/* DELETE PRODUCT */
app.post("/delete-product", (req, res) => {
  products = products.filter(p => p.id !== req.body.id);
  res.json({ message: "deleted" });
});

/* EDIT PRODUCT */
app.post("/edit-product", (req, res) => {

  let product = products.find(p => p.id === req.body.id);

  if (product) {
    product.name = req.body.name;
    product.price = req.body.price;
  }

  res.json(product);
});

/* ================= ORDERS ================= */

app.get("/orders", (req, res) => {
  res.json(orders);
});

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

  res.json(order);
});

app.post("/order-status", (req, res) => {

  let order = orders.find(o => o.id === req.body.id);
  if (order) order.status = req.body.status;

  res.json(order);
});

app.post("/tracking", (req, res) => {

  let order = orders.find(o => o.id === req.body.id);
  if (order) order.tracking = req.body.tracking;

  res.json(order);
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
