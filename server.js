const express = require("express");
const cors = require("cors");
const multer = require("multer");
const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ================= STORAGE ================= */

let products = [];
let orders = [];

/* ================= IMAGE UPLOAD ================= */

const storage = multer.diskStorage({
destination:"uploads/",
filename:(req,file,cb)=>{
cb(null, Date.now()+"-"+file.originalname);
}
});

const upload = multer({storage});

/* ================= PRODUCTS ================= */

// GET PRODUCTS
app.get("/products",(req,res)=>{
res.json(products);
});

// ADD PRODUCT (WITH IMAGE)
app.post("/add-product", upload.single("image"), (req,res)=>{

let product = {
id: Date.now(),
name: req.body.name,
price: req.body.price,
image: req.file ? "/uploads/"+req.file.filename : ""
};

products.push(product);

res.json(product);

});

// DELETE PRODUCT
app.post("/delete-product",(req,res)=>{
products = products.filter(p=>p.id !== req.body.id);
res.json({success:true});
});

/* ================= ORDERS ================= */

// GET ORDERS
app.get("/orders",(req,res)=>{
res.json(orders);
});

// CREATE ORDER
app.post("/order",(req,res)=>{

let order = {
id: Date.now(),
name: req.body.name,
phone: req.body.phone,
amount: req.body.amount,
cart: req.body.cart,
status: "pending",
tracking: "Order placed",
location: req.body.location
};

orders.push(order);

res.json(order);

});

// UPDATE STATUS (approve/reject)
app.post("/order-status",(req,res)=>{

let order = orders.find(o=>o.id === req.body.id);

if(order){
order.status = req.body.status;
}

res.json(order);

});

// UPDATE TRACKING
app.post("/tracking",(req,res)=>{

let order = orders.find(o=>o.id === req.body.id);

if(order){
order.tracking = req.body.tracking;
}

res.json(order);

});

/* ================= SERVER ================= */

app.listen(3000,()=>{
console.log("Server running on port 3000");
});
