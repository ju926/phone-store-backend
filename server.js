import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

/* FILES */
const ORDERS_FILE = "./orders.json";
const USERS_FILE = "./users.json";

/* ================= SAFE FILE HANDLING ================= */

function read(file){
  try{
    if(!fs.existsSync(file)) return [];
    const data = fs.readFileSync(file);
    return JSON.parse(data || "[]");
  }catch(e){
    console.log("Read error:", e);
    return [];
  }
}

function write(file,data){
  try{
    fs.writeFileSync(file, JSON.stringify(data,null,2));
  }catch(e){
    console.log("Write error:", e);
  }
}

/* ================= HOME ================= */

app.get("/",(req,res)=>{
  res.send("Backend Running ✔");
});

/* ================= USERS ================= */

/* REGISTER */
app.post("/register",(req,res)=>{

  let users = read(USERS_FILE);

  const { name, phone, password } = req.body;

  if(!name || !phone || !password){
    return res.status(400).json({msg:"Missing fields"});
  }

  /* prevent duplicate */
  let exists = users.find(u=>u.phone===phone);

  if(exists){
    return res.status(400).json({msg:"User exists"});
  }

  const user = {
    id: Date.now(),
    name,
    phone,
    password
  };

  users.push(user);
  write(USERS_FILE,users);

  res.json(user);
});

/* LOGIN */
app.post("/login",(req,res)=>{

  let users = read(USERS_FILE);

  const { phone, password } = req.body;

  const user = users.find(
    u => u.phone === phone && u.password === password
  );

  if(!user){
    return res.status(401).json({msg:"Invalid login"});
  }

  res.json(user);
});

/* ================= ORDERS ================= */

/* GET ALL (ADMIN) */
app.get("/orders",(req,res)=>{
  res.json(read(ORDERS_FILE));
});

/* CREATE ORDER */
app.post("/order",(req,res)=>{

  let orders = read(ORDERS_FILE);

  const {
    userId,
    name,
    phone,
    location,
    method,
    transactionId,
    amount,
    cart,
    time
  } = req.body;

  if(!name || !phone || !location || !method || !transactionId){
    return res.status(400).json({msg:"Missing order fields"});
  }

  const order = {
    id: Date.now(),

    /* USER */
    userId,
    name,
    phone,
    location,

    /* PAYMENT */
    method,
    transactionId,
    amount,
    cart,

    /* STATUS */
    status: "pending",
    tracking: "Order received",

    time
  };

  orders.push(order);
  write(ORDERS_FILE,orders);

  res.json(order);
});

/* APPROVE / REJECT */
app.post("/order-status",(req,res)=>{

  let orders = read(ORDERS_FILE);

  const { id, status } = req.body;

  let index = orders.findIndex(o => o.id == id);

  if(index === -1){
    return res.status(404).json({msg:"Order not found"});
  }

  /* ❌ DELETE REJECTED */
  if(status === "rejected"){
    orders = orders.filter(o => o.id != id);
    write(ORDERS_FILE,orders);
    return res.json({msg:"Order deleted"});
  }

  if(orders[index].status !== "pending"){
    return res.status(400).json({msg:"Already processed"});
  }

  orders[index].status = status;

  if(status === "approved"){
    orders[index].tracking = "Payment confirmed";
  }

  write(ORDERS_FILE,orders);

  res.json(orders[index]);
});

/* UPDATE TRACKING */
app.post("/tracking",(req,res)=>{

  let orders = read(ORDERS_FILE);

  const { id, tracking } = req.body;

  let order = orders.find(o => o.id == id);

  if(!order){
    return res.status(404).json({msg:"Order not found"});
  }

  order.tracking = tracking;

  write(ORDERS_FILE,orders);

  res.json(order);
});

/* CUSTOMER ORDERS (BY PHONE) */
app.get("/my-orders/:phone",(req,res)=>{

  let orders = read(ORDERS_FILE);

  const result = orders.filter(
    o => o.phone === req.params.phone
  );

  res.json(result);
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("Server running on port", PORT);
});
