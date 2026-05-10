<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SasaPay Payment</title>

<style>
body{
margin:0;
font-family:Arial;
background:#0b1220;
color:white;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
}

.box{
width:90%;
max-width:400px;
background:#111827;
padding:20px;
border-radius:12px;
}

input{
width:100%;
padding:12px;
margin-bottom:12px;
border:none;
border-radius:10px;
background:#1f2937;
color:white;
}

button{
width:100%;
padding:14px;
border:none;
border-radius:10px;
background:#22c55e;
color:white;
font-weight:bold;
cursor:pointer;
}

#logs{
margin-top:15px;
background:#0f172a;
padding:10px;
border-radius:10px;
height:160px;
overflow:auto;
font-size:12px;
}
</style>
</head>

<body>

<div class="box">

<h2>💳 SasaPay Checkout</h2>

<input id="amount" type="number" placeholder="Amount">
<input id="phone" type="text" placeholder="2547XXXXXXXX">

<button id="payBtn" onclick="payNow()">Pay Now</button>

<div id="logs"></div>

</div>

<script>

const API = "https://phone-store-backend-9w7p.onrender.com";

function log(msg){
const box = document.getElementById("logs");
const time = new Date().toLocaleTimeString();
box.innerHTML += `[${time}] ${msg}<br>`;
box.scrollTop = box.scrollHeight;
console.log(msg);
}

async function payNow(){

const amount = Number(document.getElementById("amount").value);
const phone = document.getElementById("phone").value;

if(!amount || amount <= 0){
alert("Invalid amount");
return;
}

if(!phone){
alert("Enter phone");
return;
}

log("🚀 Sending payment request...");

try{

const res = await fetch(API + "/sasapay/pay", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
phone,
total: amount,
items:[{ name:"Phone", price:amount, quantity:1 }]
})
});

const data = await res.json();

log("📥 RESPONSE:");
log(JSON.stringify(data, null, 2));

if(data.success){
log("✔ Payment initiated");
alert("Check your phone for STK push");
}else{
log("❌ Payment failed");
}

}catch(err){
log("🔥 ERROR: " + err.message);
}

}

</script>

</body>
</html>
