import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const FILE = "./orders.json";

/* READ ORDERS */
function getOrders(){
  if(!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE));
}

/* SAVE ORDERS */
function saveOrders(data){
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/* GET ORDERS */
app.get("/orders", (req,res)=>{
  res.json(getOrders());
});

/* CREATE ORDER */
app.post("/order", (req,res)=>{
  let orders = getOrders();

  const order = {
    id: Date.now(),
    ...req.body,
    status: "pending"
  };

  orders.push(order);
  saveOrders(orders);

  res.json(order);
});

/* 🔥 APPROVE / REJECT */
app.post("/order-status", (req,res)=>{
  let orders = getOrders();

  const { id, status } = req.body;

  const index = orders.findIndex(o => o.id == id);

  if(index === -1){
    return res.status(404
