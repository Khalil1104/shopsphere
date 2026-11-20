const Cart = require("../models/cart");
const Product = require("../models/product");
const { PUBLISHED_STATUS } = require("../config/constants");

// Build the cart with live product name, price and subtotals
async function buildCartView(clientId) {
  const cart = await Cart.findOne({ clientId }).populate(
    "items.productId",
    "name price stock status"
  );
  if (!cart) return { clientId, items: [], total: 0 };

  const items = cart.items
    .filter((i) => i.productId) // ignore products deleted from the catalogue
    .map((i) => ({
      productId: i.productId._id,
      name: i.productId.name,
      price: i.productId.price,
      quantity: i.quantity,
      subtotal: i.productId.price * i.quantity,
    }));
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  return { cartId: cart._id, clientId, items, total };
}

// Afficher le panier
async function getCart(req, res, next) {
  try {
    res.status(200).json(await buildCartView(req.user.id));
  } catch (err) {
    next(err);
  }
}

// Ajouter un produit
async function addItem(req, res, next) {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product || product.status !== PUBLISHED_STATUS) {
      return res.status(404).json({ message: "Produit introuvable" });
    }

    let cart = await Cart.findOne({ clientId: req.user.id });
    if (!cart) cart = new Cart({ clientId: req.user.id, items: [] });

    const existing = cart.items.find((i) => i.productId.toString() === productId);
    const newQuantity = (existing ? existing.quantity : 0) + quantity;
    if (newQuantity > product.stock) {
      return res
        .status(409)
        .json({ message: `Stock insuffisant (disponible : ${product.stock})` });
    }

    if (existing) existing.quantity = newQuantity;
    else cart.items.push({ productId, quantity });

    await cart.save();
    res.status(201).json(await buildCartView(req.user.id));
  } catch (err) {
    next(err);
  }
}

// Modifier la quantité
async function updateItem(req, res, next) {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ clientId: req.user.id });
    if (!cart) return res.status(404).json({ message: "Panier vide" });

    const item = cart.items.find((i) => i.productId.toString() === productId);
    if (!item) return res.status(404).json({ message: "Produit absent du panier" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });
    if (quantity > product.stock) {
      return res
        .status(409)
        .json({ message: `Stock insuffisant (disponible : ${product.stock})` });
    }

    item.quantity = quantity;
    await cart.save();
    res.status(200).json(await buildCartView(req.user.id));
  } catch (err) {
    next(err);
  }
}

// Retirer un produit
async function removeItem(req, res, next) {
  try {
    const cart = await Cart.findOne({ clientId: req.user.id });
    if (!cart) return res.status(404).json({ message: "Panier vide" });

    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.productId.toString() !== req.params.productId);
    if (cart.items.length === before) {
      return res.status(404).json({ message: "Produit absent du panier" });
    }

    await cart.save();
    res.status(200).json(await buildCartView(req.user.id));
  } catch (err) {
    next(err);
  }
}

// Vider le panier
async function clearCart(req, res, next) {
  try {
    await Cart.findOneAndUpdate({ clientId: req.user.id }, { $set: { items: [] } });
    res.status(200).json({ message: "Panier vidé" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };