const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  { name: String, price: Number, stock: Number, status: String },
  { strict: false }
);

// "mongoose.models.product ||" avoids an error when Melek's model is merged in the same project
module.exports =
  mongoose.models.product || mongoose.model("product", productSchema, "products");