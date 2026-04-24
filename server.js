import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const FILE = "./orders.json";

/* READ */
function getOrders(){
  if(!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE));
}

/* SAVE */
function saveOrders(data){
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/* HOME */
app.get("/", (req,res)=>{
  res.send("Backend running ✔");
});

/* GET ORDERS */
app.get("/orders",(req,res)=>{
  res.json(getOrders());
});

/* CREATE ORDER */
app.post("/order",(req,res)=>{
  let orders = getOrders();

  const order = {
    id: Date.now(),
    method: req.body.method,
    transactionId: req.body.transactionId,
    amount: req.body.amount,
    cart: req.body.cart,
    time: req.body.time,
    status: "pending"
  };

  orders.push(order);
  saveOrders(orders);

  res.json(order);
});

/* UPDATE STATUS */
app.post("/order-status",(req,res)=>{
  let orders = getOrders();

  const { id, status } = req.body;

  const index = orders.findIndex(o => o.id == id);

  if(index === -1){
    return res.status(404).json({message:"Order not found"});
  }

  if(orders[index].status !== "pending"){
    return res.status(400).json({message:"Already processed"});
  }

  orders[index].status = status;
  saveOrders(orders);

  res.json({message:"Updated"});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log("Server running"));
