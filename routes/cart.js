const express = require("express");
const router = express.Router();
const { auth, requireRole } = require("../middlewares/auth");
const { validate, validateObjectId, schemas } = require("../middlewares/validation");
const cartController = require("../controller/CartController");

// the cart is for clients only
router.use(auth, requireRole("client"));

router.get("/", cartController.getCart);
router.post("/items", validate(schemas.addItem), cartController.addItem);
router.put(
  "/items/:productId",
  validateObjectId("productId"),
  validate(schemas.updateItem),
  cartController.updateItem
);
router.delete("/items/:productId", validateObjectId("productId"), cartController.removeItem);
router.delete("/", cartController.clearCart);

module.exports = router;