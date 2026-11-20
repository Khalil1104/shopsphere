const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    items: [
      {
        _id: false,
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("cart", cartSchema);