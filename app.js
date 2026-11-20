require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const dbconnect = require("./config/dbconnection.json");

mongoose
  .connect(dbconnect.url)
  .then(() => console.log("database connected!!"))
  .catch((err) => console.log(err));

const cartRouter = require("./routes/cart");
const orderRouter = require("./routes/orders");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Panier et commandes service is alive!");
});

app.use("/api/cart", cartRouter);
app.use("/api/orders", orderRouter);

// route not found
app.use((req, res) => {
  res.status(404).json({ message: "Route introuvable" });
});

// global error handler
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "JSON invalide" });
  }
  console.error(err);
  res.status(500).json({ message: "Erreur serveur" });
});

const port = process.env.PORT || 3003;
http
  .createServer(app)
  .listen(port, () => console.log(`Panier et commandes running on port ${port}`));

module.exports = app;