const ETAPES = ['en_preparation', 'expediee', 'en_transit', 'livree'];

const LIBELLES = {
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  en_transit: 'En transit',
  livree: 'Livrée',
  echec: 'Échec de livraison'
};

const TRANSITIONS = {
  en_preparation: ['expediee', 'echec'],
  expediee: ['en_transit', 'echec'],
  en_transit: ['livree', 'echec'],
  livree: [],
  echec: []
};

const STATUTS_ACTIFS = ['en_preparation', 'expediee', 'en_transit'];

// Livraison gratuite au-dessus du seuil de la zone
const calculerFrais = (zone, montant) => {
  if (zone.seuilGratuit !== null && zone.seuilGratuit !== undefined && montant >= zone.seuilGratuit) return 0;
  return zone.frais;
};

const jourBornes = (date) => {
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(date);
  fin.setHours(23, 59, 59, 999);
  return { debut, fin };
};

const escapeRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { ETAPES, LIBELLES, TRANSITIONS, STATUTS_ACTIFS, calculerFrais, jourBornes, escapeRegex };
