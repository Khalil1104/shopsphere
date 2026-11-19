const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const controller = require('../controller/reviewController');

test('Review impose un index unique produit-client', () => {
  const index = Review.schema.indexes().find(([fields]) => fields.productId === 1 && fields.clientId === 1);
  assert.ok(index);
  assert.equal(index[1].unique, true);
});

test('Review refuse une note hors de 1 à 5', () => {
  const avis = new Review({
    productId: new mongoose.Types.ObjectId(),
    clientId: new mongoose.Types.ObjectId(),
    orderId: new mongoose.Types.ObjectId(),
    note: 6,
    commentaire: 'Test'
  });
  assert.equal(avis.validateSync().errors.note.kind, 'max');
});

test('un client ne peut pas commenter sans commande livrée contenant le produit', async () => {
  const ancienneRecherche = Order.findOne;
  Order.findOne = async () => null;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  try {
    await controller.creer(
      {
        user: { id: new mongoose.Types.ObjectId().toString() },
        validated: {
          body: {
            productId: new mongoose.Types.ObjectId().toString(),
            orderId: new mongoose.Types.ObjectId().toString(),
            note: 5,
            commentaire: 'Bon produit'
          }
        }
      },
      res
    );
    assert.equal(res.statusCode, 403);
    assert.equal(typeof res.body.message, 'string');
  } finally {
    Order.findOne = ancienneRecherche;
  }
});
