import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

/* FILES */
const USERS_FILE = "./users.json";
const ORDERS_FILE = "./orders.json";

/* ================= HELPERS ================= */

function read(file){
  try{
    if(!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file));
  }catch(e){
    return [];
  }
}

function write(file,data){
  fs.writeFileSync(file, JSON.stringify(data,null,2));
}

/* ================= HOME ================= */

app.get("/",(req,res)=>{
  res.send("Backend Running ✔");
});

/* ================= USERS ================= */

/* REGISTER */
app.post("/register",(req,res)=>{

  let users = read(USERS_FILE);

  const { name, phone, email, password } = req.body;

  if(!name || !password){
    return res.status(400).json({msg:"Missing fields"});
  }

  const user = {
    id: Date.now(),
    name,
    phone: phone || "",
    email: email || "",
    password
  };

  users.push(user);
  write(USERS_FILE,users);

  res.json(user);
});

/* LOGIN */
app.post("/login",(req,res)=>{

  let users = read(USERS_FILE);

  const { phone, email, password } = req.body;

  const user = users.find(u =>
    (phone && u.phone === phone) ||
    (email && u.email === email)
  );

  if(!user){
    return res.status(401).json({msg:"User not found"});
  }

  if(user.password !== password){
    return res.status(401).json({msg:"Wrong password"});
  }

  res.json(user);
});

/* ================= ORDERS ================= */

/* GET ALL ORDERS (ADMIN) */
app.get("/orders",(req,res)=>{
  res.json(read(ORDERS_FILE));
});

/* CREATE ORDER */
app.post("/order",(req,res)=>{

  let orders = read(ORDERS_FILE);

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
  write(ORDERS_FILE,orders);

  res.json(order);
});

/* APPROVE / REJECT */
app.post("/order-status",(req,res)=>{

  let orders = read(ORDERS_FILE);

  const { id, status } = req.body;

  let index = orders.findIndex(o => o.id == id);

  if(index === -1){
    return res.status(404).json({msg:"Not found"});
  }

  /* DELETE IF REJECTED */
  if(status === "rejected"){
    orders = orders.filter(o => o.id != id);
    write(ORDERS_FILE,orders);
    return res.json({msg:"Deleted"});
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
    return res.status(404).json({msg:"Not found"});
  }

  order.tracking = tracking;

  write(ORDERS_FILE,orders);

  res.json(order);
});

/* CUSTOMER ORDERS */
app.get("/my-orders/:phone",(req,res)=>{

  let orders = read(ORDERS_FILE);

  res.json(
    orders.filter(o => o.phone === req.params.phone)
  );
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("Server running on port", PORT);
});
