const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const { sendMail } = require('./mailService');
const { LIBELLES, STATUTS_ACTIFS } = require('./deliveryRules');

// Lecture seule de la collection clients (module 1)
const notifierChangementEtape = async (delivery) => {
  try {
    const client = await mongoose.connection.collection('clients').findOne(
      { _id: new mongoose.Types.ObjectId(String(delivery.clientId)) },
      { projection: { email: 1, prenom: 1 } }
    );
    if (!client || !client.email) return;

    await sendMail({
      to: client.email,
      subject: `ShopSphere - Votre livraison : ${LIBELLES[delivery.statut]}`,
      text:
        `Bonjour ${client.prenom || ''},\n\n` +
        `Votre commande ${delivery.orderId} est maintenant : ${LIBELLES[delivery.statut]}.\n` +
        `Livraison prévue le ${new Date(delivery.datePrevue).toLocaleDateString('fr-FR')}.\n\n` +
        `L'équipe ShopSphere`
    });
  } catch (e) {
    console.error('Notification client échouée :', e.message);
  }
};

// Alerte les admins pour les livraisons en retard ; retourne le nombre de retards
const alerterRetards = async () => {
  const retards = await Delivery.find({
    datePrevue: { $lt: new Date() },
    statut: { $in: STATUTS_ACTIFS }
  });
  if (retards.length === 0) return 0;

  const admins = await mongoose.connection.collection('admins').find({}, { projection: { email: 1 } }).toArray();
  const to = admins.map((a) => a.email).filter(Boolean).join(',');
  if (!to) {
    console.log(`[ALERTE] ${retards.length} livraison(s) en retard, mais aucun admin avec e-mail trouvé`);
    return retards.length;
  }

  const lignes = retards.map(
    (d) => `- Commande ${d.orderId} (${d.adresse.gouvernorat}) prévue le ${new Date(d.datePrevue).toLocaleDateString('fr-FR')}, statut : ${LIBELLES[d.statut]}`
  );
  await sendMail({
    to,
    subject: `ShopSphere - ${retards.length} livraison(s) en retard`,
    text: `Livraisons en retard :\n\n${lignes.join('\n')}`
  });
  return retards.length;
};

module.exports = { notifierChangementEtape, alerterRetards };
