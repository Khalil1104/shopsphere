const mongoose = require("mongoose");
const Order = require("../models/order");
const Cart = require("../models/cart");
const Product = require("../models/product");
const Counter = require("../models/counter");
const { PUBLISHED_STATUS } = require("../config/constants");
const PDFDocument = require("pdfkit");

// Métier 2: allowed status transitions
const NEXT_STATUS = {
  en_attente: ["confirmee", "annulee"],
  confirmee: ["expediee", "annulee"],
  expediee: ["livree"],
  livree: [],
  annulee: [],
};

// Statuses counted in the statistics (paid or beyond, not cancelled)
const COUNTED = ["confirmee", "expediee", "livree"];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `order-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `CMD-${year}-${String(counter.seq).padStart(4, "0")}`;
}

async function restoreStock(items) {
  await Promise.all(
    items.map((i) => Product.updateOne({ _id: i.productId }, { $inc: { stock: i.quantity } }))
  );
}

async function applyStatus(order, status, userId) {
  order.status = status;
  order.statusHistory.push({ status, changedBy: userId });
  await order.save();
  if (status === "annulee") await restoreStock(order.items);
}

// Load an order if the user is the owner or an admin, otherwise answer 404 / 403
async function findAccessibleOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: "Commande introuvable" });
    return null;
  }
  if (req.user.role !== "admin" && order.clientId.toString() !== req.user.id) {
    res.status(403).json({ message: "Accès refusé" });
    return null;
  }
  return order;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateMatch(from, to) {
  if (!from && !to) return {};
  const createdAt = {};
  if (from) createdAt.$gte = from;
  if (to) createdAt.$lte = to;
  return { createdAt };
}

/* ---------- CRUD ---------- */

// Ajouter + métier 1: validate the order from the cart
async function createOrder(req, res, next) {
  const reserved = []; // stock already taken, to give back if something fails
  try {
    const cart = await Cart.findOne({ clientId: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Le panier est vide" });
    }

    const lines = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.status !== PUBLISHED_STATUS) {
        throw httpError(409, "Un produit du panier n'est plus disponible");
      }

      // decrement only if there is enough stock (atomic)
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
      if (!updated) {
        throw httpError(409, `Stock insuffisant pour « ${product.name} »`);
      }
      reserved.push({ productId: product._id, quantity: item.quantity });

      // price frozen at this moment
      lines.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      });
    }

    const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const order = await Order.create({
      orderNumber: await nextOrderNumber(),
      clientId: req.user.id,
      items: lines,
      total,
      address: req.body.address,
      status: "en_attente",
      statusHistory: [{ status: "en_attente", changedBy: req.user.id }],
    });

    cart.items = [];
    await cart.save();

    res.status(201).json(order);
  } catch (err) {
    await restoreStock(reserved); // rollback
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

// Afficher: my orders
async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ clientId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
}

// Afficher: one order
async function getOrder(req, res, next) {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

// Afficher (admin): list with search, filters, pagination
async function listOrders(req, res, next) {
  try {
    const { search, status, from, to, page, limit } = req.query;
    const filter = { ...dateMatch(from, to) };
    if (status) filter.status = status;
    if (search) {
      const or = [{ orderNumber: { $regex: escapeRegex(search), $options: "i" } }];
      if (mongoose.isValidObjectId(search)) or.push({ clientId: search });
      filter.$or = or;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({ page, limit, total, pages: Math.ceil(total / limit), orders });
  } catch (err) {
    next(err);
  }
}

// Modifier: delivery address, only before shipping
async function updateOrder(req, res, next) {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;

    if (!["en_attente", "confirmee"].includes(order.status)) {
      return res
        .status(409)
        .json({ message: "L'adresse ne peut plus être modifiée pour cette commande" });
    }

    order.address = req.body.address;
    await order.save();
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

// Supprimer (admin): only cancelled orders
async function deleteOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    if (order.status !== "annulee") {
      return res
        .status(409)
        .json({ message: "Seule une commande annulée peut être supprimée" });
    }
    await order.deleteOne();
    res.status(200).json({ message: "Commande supprimée" });
  } catch (err) {
    next(err);
  }
}

/* ---------- Métier 2: statuts et annulation ---------- */

// Client or admin: cancel while not shipped
async function cancelOrder(req, res, next) {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;

    if (!NEXT_STATUS[order.status].includes("annulee")) {
      return res.status(409).json({
        message: "Impossible d'annuler une commande expédiée, livrée ou déjà annulée",
      });
    }

    await applyStatus(order, "annulee", req.user.id);
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

// Admin: move the order along the status chain
async function changeStatus(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Commande introuvable" });

    const { status } = req.body;
    if (!NEXT_STATUS[order.status].includes(status)) {
      return res
        .status(409)
        .json({ message: `Transition impossible : ${order.status} → ${status}` });
    }

    await applyStatus(order, status, req.user.id);
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

/* ---------- Métier 3: statistiques (admin) ---------- */

async function revenueStats(req, res, next) {
  try {
    const { period, from, to } = req.query;
    const format = period === "month" ? "%Y-%m" : "%Y-%m-%d";
    const stats = await Order.aggregate([
      { $match: { status: { $in: COUNTED }, ...dateMatch(from, to) } },
      {
        $group: {
          _id: { $dateToString: { format, date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}

async function averageBasket(req, res, next) {
  try {
    const { from, to } = req.query;
    const [result] = await Order.aggregate([
      { $match: { status: { $in: COUNTED }, ...dateMatch(from, to) } },
      {
        $group: {
          _id: null,
          averageBasket: { $avg: "$total" },
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
      { $project: { _id: 0 } },
    ]);
    res.status(200).json(result || { averageBasket: 0, orders: 0, revenue: 0 });
  } catch (err) {
    next(err);
  }
}

async function topProducts(req, res, next) {
  try {
    const { from, to, limit } = req.query;
    const stats = await Order.aggregate([
      { $match: { status: { $in: COUNTED }, ...dateMatch(from, to) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: limit },
    ]);
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}
/* ---------- Métier 4 (bonus): PDF récapitulatif ---------- */

async function orderPdf(req, res, next) {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${order.orderNumber}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text("ShopSphere - Récapitulatif de commande");
    doc.moveDown();
    doc.fontSize(12).text(`Commande : ${order.orderNumber}`);
    doc.text(`Date : ${order.createdAt.toLocaleDateString("fr-FR")}`);
    doc.text(`Statut : ${order.status}`);
    doc.moveDown();

    doc.fontSize(14).text("Articles");
    doc.fontSize(12);
    order.items.forEach((i) => {
      doc.text(`${i.name}  x${i.quantity}  -  ${(i.price * i.quantity).toFixed(2)} TND`);
    });
    doc.moveDown();
    doc.fontSize(14).text(`Total : ${order.total.toFixed(2)} TND`);
    doc.moveDown();

    doc.fontSize(12).text("Adresse de livraison");
    doc.text(`${order.address.street}, ${order.address.city}`);
    doc.text(`${order.address.governorate} ${order.address.postalCode || ""}`);
    doc.text(`Tél : ${order.address.phone}`);

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getOrder,
  listOrders,
  updateOrder,
  deleteOrder,
  cancelOrder,
  changeStatus,
  revenueStats,
  averageBasket,
  topProducts,
  orderPdf,
};