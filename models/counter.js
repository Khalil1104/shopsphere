const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.models.counter || mongoose.model("counter", counterSchema);