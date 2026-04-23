import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const FILE = "./orders.json";

// Load orders
function getOrders(){
  if(!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE));
}

// Save orders
function saveOrders(data){
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// 📥 RECEIVE ORDER
app.post("/order", (req, res) => {
  const orders = getOrders();

  const newOrder = {
    id: Date.now(),
    ...req.body,
    status: "pending"
  };

  orders.push(newOrder);
  saveOrders(orders);

  res.json({ success: true, message: "Order received" });
});

// 📤 GET ALL ORDERS (ADMIN)
app.get("/orders", (req, res) => {
  res.json(getOrders());
});

// 🟢 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
