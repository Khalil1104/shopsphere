// Liste de mots interdits (à compléter)
const MOTS_INTERDITS = ['idiot', 'imbecile', 'stupide', 'escroc', 'voleur', 'nul'];

// Enlève les accents et met en minuscules : "Imbécile" devient "imbecile"
function normaliser(texte) {
  return texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Renvoie true si le texte contient un mot interdit (mot entier seulement)
function contientMotInterdit(texte) {
  const propre = normaliser(texte);
  return MOTS_INTERDITS.some((mot) => new RegExp(`\\b${mot}\\b`).test(propre));
}

module.exports = { contientMotInterdit };