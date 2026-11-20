const mongoose = require("mongoose");

const STATUSES = ["en_attente", "confirmee", "expediee", "livree", "annulee"];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    items: [
      {
        _id: false,
        productId: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: String,
        price: Number, // frozen price at the time of the order
        quantity: Number,
      },
    ],
    total: { type: Number, required: true },
    address: {
      street: String,
      city: String,
      governorate: String,
      postalCode: String,
      phone: String,
    },
    status: { type: String, enum: STATUSES, default: "en_attente", index: true },
    statusHistory: [
      {
        _id: false,
        status: String,
        date: { type: Date, default: Date.now },
        changedBy: mongoose.Schema.Types.ObjectId,
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

const Order = mongoose.model("order", orderSchema);
Order.STATUSES = STATUSES;

module.exports = Order;