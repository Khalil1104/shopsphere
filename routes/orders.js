const express = require("express");
const router = express.Router();
const { auth, requireRole } = require("../middlewares/auth");
const { validate, validateObjectId, schemas } = require("../middlewares/validation");
const orderController = require("../controller/OrderController");

router.use(auth);

// client
router.post("/", requireRole("client"), validate(schemas.createOrder), orderController.createOrder);
router.get("/my", requireRole("client"), orderController.getMyOrders);

// admin: statistics (before /:id)
router.get("/stats/revenue", requireRole("admin"), validate(schemas.statsQuery, "query"), orderController.revenueStats);
router.get("/stats/average-basket", requireRole("admin"), validate(schemas.statsQuery, "query"), orderController.averageBasket);
router.get("/stats/top-products", requireRole("admin"), validate(schemas.statsQuery, "query"), orderController.topProducts);

// admin: list and status
router.get("/", requireRole("admin"), validate(schemas.listQuery, "query"), orderController.listOrders);
router.patch("/:id/status", requireRole("admin"), validateObjectId("id"), validate(schemas.changeStatus), orderController.changeStatus);

// client (own orders) or admin
router.patch("/:id/cancel", validateObjectId("id"), orderController.cancelOrder);
router.get("/:id", validateObjectId("id"), orderController.getOrder);
router.put("/:id", validateObjectId("id"), validate(schemas.updateOrder), orderController.updateOrder);
router.get("/:id/pdf", validateObjectId("id"), orderController.orderPdf);

// admin
router.delete("/:id", requireRole("admin"), validateObjectId("id"), orderController.deleteOrder);

module.exports = router;