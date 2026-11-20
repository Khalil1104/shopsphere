const MOTS_URGENTS = ['urgent', 'remboursement', 'fraude', 'vol', 'perdu'];

function normaliser(texte) {
  return texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Renvoie "haute" si un mot urgent est présent, sinon "normale"
function calculerPriorite(sujet, texte) {
  const propre = normaliser(`${sujet} ${texte}`);
  const urgent = MOTS_URGENTS.some((mot) => new RegExp(`\\b${mot}\\b`).test(propre));
  return urgent ? 'haute' : 'normale';
}

// Passages de statut autorisés
const TRANSITIONS = {
  ouvert: ['en_cours', 'resolu', 'ferme'],
  en_cours: ['resolu', 'ferme'],
  resolu: ['en_cours', 'ferme'],
  ferme: []
};

module.exports = { calculerPriorite, TRANSITIONS };