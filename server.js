import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const FILE = "./orders.json";
const USERS = "./users.json";

/* SAFE READ/WRITE */
const read = (f) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];
const write = (f,d) => fs.writeFileSync(f, JSON.stringify(d,null,2));

/* ================= USERS ================= */

/* REGISTER (simple) */
app.post("/register",(req,res)=>{
  let users = read(USERS);

  const user = {
    id: Date.now(),
    name: req.body.name,
    phone: req.body.phone,
    password: req.body.password
  };

  users.push(user);
  write(USERS,users);

  res.json(user);
});

/* LOGIN */
app.post("/login",(req,res)=>{
  let users = read(USERS);

  const user = users.find(
    u=>u.phone===req.body.phone && u.password===req.body.password
  );

  if(!user) return res.status(401).json({msg:"invalid"});

  res.json(user);
});

/* ================= ORDERS ================= */

app.get("/orders",(req,res)=>{
  res.json(read(FILE));
});

/* CREATE ORDER (WITH DELIVERY INFO) */
app.post("/order",(req,res)=>{
  let orders = read(FILE);

  const order = {
    id: Date.now(),
    userId: req.body.userId,
    name: req.body.name,
    phone: req.body.phone,
    location: req.body.location,

    method: req.body.method,
    transactionId: req.body.transactionId,
    amount: req.body.amount,
    cart: req.body.cart,

    status: "pending",
    tracking: "Order received",
    time: req.body.time
  };

  orders.push(order);
  write(FILE,orders);

  res.json(order);
});

/* STATUS UPDATE */
app.post("/order-status",(req,res)=>{
  let orders = read(FILE);

  const {id,status} = req.body;

  let i = orders.findIndex(o=>o.id==id);

  if(i===-1) return res.status(404).json({msg:"not found"});

/* ❌ DELETE IF REJECTED */
  if(status==="rejected"){
    orders = orders.filter(o=>o.id!=id);
    write(FILE,orders);
    return res.json({msg:"deleted"});
  }

  orders[i].status = status;

  if(status==="approved"){
    orders[i].tracking="Payment confirmed";
  }

  write(FILE,orders);

  res.json(orders[i]);
});

/* TRACKING UPDATE */
app.post("/tracking",(req,res)=>{
  let orders = read(FILE);

  let o = orders.find(x=>x.id==req.body.id);

  if(!o) return res.status(404).json({msg:"not found"});

  o.tracking = req.body.tracking;

  write(FILE,orders);

  res.json(o);
});

/* CUSTOMER ORDERS */
app.get("/my-orders/:phone",(req,res)=>{
  let orders = read(FILE);

  res.json(
    orders.filter(o=>o.phone===req.params.phone)
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("running"));
