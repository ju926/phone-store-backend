import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const FILE = "./orders.json";

/* SAFE READ/WRITE */
const read = () =>
  fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : [];

const write = (data) =>
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

/* HOME */
app.get("/", (req, res) => {
  res.send("Backend Running ✔");
});

/* GET ORDERS */
app.get("/orders", (req, res) => {
  res.json(read());
});

/* CREATE ORDER */
app.post("/order", (req, res) => {
  let orders = read();

  const order = {
    id: Date.now(),
    method: req.body.method,
    transactionId: req.body.transactionId,
    amount: req.body.amount,
    cart: req.body.cart,
    time: req.body.time,
    status: "pending",
    tracking: "Order received"
  };

  orders.push(order);
  write(orders);

  res.json(order);
});

/* APPROVE / REJECT */
app.post("/order-status", (req, res) => {
  let orders = read();

  const { id, status } = req.body;

  let i = orders.findIndex(o => o.id == id);

  if (i === -1) return res.status(404).json({ msg: "Not found" });

  /* ❌ AUTO DELETE REJECTED */
  if (status === "rejected") {
    orders = orders.filter(o => o.id != id);
    write(orders);
    return res.json({ msg: "deleted" });
  }

  if (orders[i].status !== "pending") {
    return res.status(400).json({ msg: "Already processed" });
  }

  orders[i].status = status;

  if (status === "approved") {
    orders[i].tracking = "Payment confirmed";
  }

  write(orders);

  res.json(orders[i]);
});

/* TRACKING UPDATE (ADMIN) */
app.post("/tracking", (req, res) => {
  let orders = read();

  const { id, tracking } = req.body;

  let order = orders.find(o => o.id == id);

  if (!order) return res.status(404).json({ msg: "Not found" });

  order.tracking = tracking;

  write(orders);

  res.json(order);
});

/* CUSTOMER TRACKING */
app.get("/my-orders/:tx", (req, res) => {
  let orders = read();

  res.json(
    orders.filter(o => o.transactionId === req.params.tx)
  );
});

/* START */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running"));
