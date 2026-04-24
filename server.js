import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const FILE = "orders.json";

/* GET ALL ORDERS */
app.get("/orders", (req, res) => {
  try {
    if (!fs.existsSync(FILE)) return res.json([]);
    const data = JSON.parse(fs.readFileSync(FILE));
    res.json(data);
  } catch {
    res.status(500).json({ error: "Error reading orders" });
  }
});

/* CREATE ORDER */
app.post("/order", (req, res) => {
  try {
    let orders = [];

    if (fs.existsSync(FILE)) {
      orders = JSON.parse(fs.readFileSync(FILE));
    }

    const newOrder = {
      id: Date.now(),
      ...req.body,
      status: "pending"
    };

    orders.push(newOrder);

    fs.writeFileSync(FILE, JSON.stringify(orders, null, 2));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error saving order" });
  }
});

/* TEST ROUTE */
app.get("/", (req, res) => {
  res.send("Backend is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
