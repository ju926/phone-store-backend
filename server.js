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

  if(username === "admin" && password === "1234"){

    return res.json({
      token: "admin-token-001"
    });

  }

  return res.status(401).json({
    error: "Invalid credentials"
  });

});

/* ---------------- GET ORDERS ---------------- */
app.get("/orders", (req, res) => {

  if (!fs.existsSync(FILE)) return res.json([]);

  const data = JSON.parse(fs.readFileSync(FILE));
  res.json(data);

});

/* ---------------- UPDATE ORDER STATUS ---------------- */
app.post("/order-status", (req, res) => {

  const { id, status } = req.body;

  if (!fs.existsSync(FILE)) return res.json({ success: false });

  let orders = JSON.parse(fs.readFileSync(FILE));

  orders = orders.map(order => {
    if(order.id === id){
      order.status = status;
    }
    return order;
  });

  fs.writeFileSync(FILE, JSON.stringify(orders, null, 2));

  res.json({ success: true });

});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
