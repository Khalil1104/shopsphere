require("dotenv").config();
const mongoose = require("mongoose");
const dbconnect = require("../config/dbconnection.json");
const Product = require("../models/product");
const { PUBLISHED_STATUS } = require("../config/constants");

(async () => {
  await mongoose.connect(dbconnect.url);
  await Product.deleteMany({ name: /^TEST / });

  const products = await Product.insertMany([
    { name: "TEST Casque Bluetooth", price: 89.9, stock: 20, status: PUBLISHED_STATUS },
    { name: "TEST Clavier mécanique", price: 129.5, stock: 10, status: PUBLISHED_STATUS },
    { name: "TEST Souris stock limité", price: 35, stock: 2, status: PUBLISHED_STATUS },
    { name: "TEST Produit brouillon", price: 50, stock: 5, status: "draft" },
  ]);

  products.forEach((p) => console.log(p.name, "->", p._id.toString()));
  await mongoose.disconnect();
})();