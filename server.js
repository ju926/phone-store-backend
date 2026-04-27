const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

// IMPORTANT: serve uploaded images
app.use("/uploads", express.static("uploads"));

/* =========================
   CREATE UPLOADS FOLDER (IMPORTANT FOR RENDER)
========================= */
if (!fs.existsSync("uploads")) {
fs.mkdirSync("uploads");
}

/* =========================
   MONGODB CONNECT
========================= */
mongoose.connect("mongodb+srv://stephanitalia306_db_user:iuicmY9Dj2gcsINi@store.eggjy60.mongodb.net/store")
.then(() => console.log("MongoDB Connected ✔"))
.catch(err => console.log("DB Error:", err));

/* =========================
   PRODUCT MODEL
========================= */
const Product = mongoose.model("Product", {
name: String,
price: Number,
image: String
});

/* =========================
   MULTER CONFIG (IMAGE UPLOAD)
========================= */
const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, "uploads/");
},
filename: (req, file, cb) => {
cb(null, Date.now() + path.extname(file.originalname));
}
});

const upload = multer({ storage });

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
res.send("API Running ✔");
});

/* =========================
   GET PRODUCTS
========================= */
app.get("/products", async (req, res) => {
const products = await Product.find();
res.json(products);
});

/* =========================
   ADD PRODUCT (FIXED UPLOAD)
========================= */
app.post("/add-product-upload", upload.single("image"), async (req, res) => {

try {

console.log("BODY:", req.body);
console.log("FILE:", req.file);

if (!req.file) {
return res.status(400).json({ message: "No image uploaded" });
}

const product = new Product({
name: req.body.name,
price: req.body.price,
image: req.file.filename
});

await product.save();

res.json(product);

} catch (err) {
console.log(err);
res.status(500).json({ message: "Server error" });
}

});

/* =========================
   DELETE PRODUCT
========================= */
app.delete("/delete-product/:id", async (req, res) => {
await Product.findByIdAndDelete(req.params.id);
res.json({ message: "Deleted ✔" });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});
