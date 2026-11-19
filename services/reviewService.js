const Review = require('../models/Review');
const Product = require('../models/Product');

async function recalculerNoteProduit(productId) {
  const [resultat] = await Review.aggregate([
    { $match: { productId, statut: 'valide' } },
    {
      $group: {
        _id: '$productId',
        noteMoyenne: { $avg: '$note' },
        nombreAvis: { $sum: 1 }
      }
    }
  ]);

  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        noteMoyenne: resultat ? Math.round(resultat.noteMoyenne * 100) / 100 : 0,
        nombreAvis: resultat ? resultat.nombreAvis : 0
      }
    }
  );
}

module.exports = { recalculerNoteProduit };
