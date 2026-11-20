// Fonctions IA : appel à l'API Claude + solutions de secours (sans clé API)
const isEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const askClaude = async ({ system, user, maxTokens = 700 }) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    }),
    signal: AbortSignal.timeout(25000)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`API IA ${res.status} ${detail.slice(0, 150)}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
};

const extraireJSON = (texte) => {
  const m = String(texte).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse IA sans JSON');
  return JSON.parse(m[0]);
};

const normaliser = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Secours : interprétation simple par mots-clés quand l'IA est indisponible
const interpreterRegles = (question, zones, couriers) => {
  const q = normaliser(question);
  const f = {};

  if (/preparation/.test(q)) f.statut = 'en_preparation';
  else if (/expedi/.test(q)) f.statut = 'expediee';
  else if (/transit/.test(q)) f.statut = 'en_transit';
  else if (/echec|echou/.test(q)) f.statut = 'echec';
  else if (/\blivre(e|es|s)?\b/.test(q)) f.statut = 'livree';

  if (/retard/.test(q)) f.enRetard = true;

  const zone = zones.find((z) => q.includes(normaliser(z.gouvernorat)));
  if (zone) f.gouvernorat = zone.gouvernorat;

  const courier = couriers.find((c) =>
    normaliser(c.nom).split(/\s+/).some((t) => t.length > 2 && !['ben', 'ibn'].includes(t) && new RegExp(`\\b${t}\\b`).test(q))
  );
  if (courier) f.livreur = courier.nom;

  if (/ancien|plus vieux/.test(q)) { f.sortBy = 'createdAt'; f.order = 'asc'; }
  if (Object.keys(f).length === 0) f.search = String(question).trim().slice(0, 100);
  return f;
};

// Secours : analyse par règles quand l'IA est indisponible
const analyseParRegles = (ind) => {
  const alertes = [];
  const recommandations = [];

  if (ind.retards.total > 0) {
    const top = ind.retards.parGouvernorat[0];
    alertes.push({
      niveau: ind.retards.total >= 3 ? 'haute' : 'moyenne',
      message: `${ind.retards.total} livraison(s) en retard, surtout à ${top.gouvernorat} (${top.count}).`
    });
    recommandations.push(`Relancer en priorité les livraisons en retard de ${top.gouvernorat}.`);
  }
  if (ind.nonAffectees > 0) {
    alertes.push({ niveau: 'moyenne', message: `${ind.nonAffectees} livraison(s) active(s) sans livreur.` });
    recommandations.push('Affecter un livreur aux livraisons non assignées avant leur date prévue.');
  }
  ind.chargeLivreurs.filter((l) => l.enCours >= l.max).forEach((l) => {
    alertes.push({ niveau: 'info', message: `${l.livreur} a ${l.enCours} livraison(s) en cours (limite journalière : ${l.max}).` });
  });
  if (ind.tauxEchecPct > 10) {
    alertes.push({ niveau: 'haute', message: `Taux d'échec élevé : ${ind.tauxEchecPct} %.` });
    recommandations.push("Analyser les causes d'échec (client absent, adresse) et prévenir le client avant la livraison.");
  }
  if (ind.delais.reelJours !== null && ind.delais.reelJours > ind.delais.promisJours) {
    alertes.push({
      niveau: 'moyenne',
      message: `Délai réel moyen (${ind.delais.reelJours} j) supérieur au délai annoncé (${ind.delais.promisJours} j).`
    });
    recommandations.push('Revoir les délais annoncés par zone ou renforcer les livreurs des zones lentes.');
  }
  if (alertes.length === 0) alertes.push({ niveau: 'info', message: 'Aucune anomalie détectée.' });

  return {
    resume: `${ind.total} livraison(s) au total : ${ind.tauxLivraisonPct} % livrées, ${ind.retards.total} en retard.`,
    alertes,
    recommandations
  };
};

module.exports = { isEnabled, askClaude, extraireJSON, interpreterRegles, analyseParRegles };
