import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

const FILE = "orders.json";

/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* ---------------- ADMIN LOGIN ---------------- */
app.post("/admin/login", (req, res) => {

  const { username, password } = req.body;

  if (username === "admin" && password === "1234") {
    return res.json({
      token: "admin-token-001"
    });
  }

  return res.status(401).json({
    error: "Invalid credentials"
  });
});

/* ---------------- SAVE ORDER ---------------- */
app.post("/order", (req, res) => {

  try {

    let order = req.body;

    let orders = [];

    if (fs.existsSync(FILE)) {
      orders = JSON.parse(fs.readFileSync(FILE, "utf8"));
    }

    orders.push(order);

    fs.writeFileSync(FILE, JSON.stringify(orders, null, 2));

    console.log("Order saved ✔");

    res.json({ success: true });

  } catch (err) {
    console.log("ORDER ERROR:", err);
    res.status(500).json({ error: "Failed to save order" });
  }

});

/* ---------------- GET ORDERS ---------------- */
app.get("/orders", (req, res) => {

  try {

    if (!fs.existsSync(FILE)) {
      return res.json([]);
    }

    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

    res.json(data);

  } catch (err) {
    console.log("GET ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }

});

/* ---------------- UPDATE ORDER STATUS ---------------- */
app.post("/order-status", (req, res) => {

  try {

    const { id, status } = req.body;

    if (!fs.existsSync(FILE)) {
      return res.json({ success: false });
    }

    let orders = JSON.parse(fs.readFileSync(FILE, "utf8"));

    orders = orders.map(order => {
      if (order.id === id) {
        order.status = status;
      }
      return order;
    });

    fs.writeFileSync(FILE, JSON.stringify(orders, null, 2));

    res.json({ success: true });

  } catch (err) {
    console.log("STATUS ERROR:", err);
    res.status(500).json({ error: "Failed to update status" });
  }

});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
