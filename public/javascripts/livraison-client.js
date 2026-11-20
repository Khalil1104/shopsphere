async function loadZones() {
  try {
    const { data } = await api('/api/zones');
    $('#calcGouv').innerHTML = data.map((z) => `<option>${esc(z.gouvernorat)}</option>`).join('');
  } catch (e) { toast(e.message, true); }
}

$('#btnCalc').onclick = async () => {
  try {
    const g = encodeURIComponent($('#calcGouv').value);
    const m = Number($('#calcMontant').value || 0);
    const { data } = await api(`/api/zones/frais?gouvernorat=${g}&montant=${m}`);
    $('#calcResult').textContent = data.gratuite
      ? `Livraison gratuite ! Délai : ${data.delaiJours} jour(s).`
      : `Frais : ${data.frais} TND. Délai : ${data.delaiJours} jour(s).`;
  } catch (e) { toast(e.message, true); }
};

async function loadMine() {
  try {
    const { data } = await api('/api/deliveries/me');
    $('#noDeliveries').style.display = data.length ? 'none' : 'block';
    $('#myDeliveries').innerHTML = data.map((d) => `
      <div class="dcard">
        <b>Commande ${esc(String(d.orderId).slice(-8))}</b>
        <span class="badge st-${esc(d.statut)}">${esc(LIB[d.statut])}</span>
        <span class="muted">${esc(d.adresse.ville)}, ${esc(d.adresse.gouvernorat)}</span>
        <span class="muted">Prévue le ${esc(fmtDay(d.datePrevue))}</span>
        <button data-id="${esc(d._id)}">Suivre mon colis</button>
      </div>`).join('');
  } catch (e) { toast(e.message, true); }
}

$('#myDeliveries').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  try {
    const { data: s } = await api(`/api/deliveries/${btn.dataset.id}/suivi`);
    $('#trackingCard').style.display = 'block';
    $('#trackingInfo').innerHTML = `
      <p>Statut : <span class="badge st-${esc(s.statut)}">${esc(s.statutLibelle)}</span>
      ${s.enRetard ? '<span class="late"> · En retard</span>' : ''}</p>
      <p class="muted">Prévue le ${esc(fmtDay(s.datePrevue))} · Frais : ${esc(s.frais)} TND
      ${s.livreur ? ' · Livreur : ' + esc(s.livreur.nom) + ' (' + esc(s.livreur.telephone) + ')' : ''}</p>`;
    let html = s.etapes.map((et) =>
      `<li class="${et.atteinte ? 'done' : ''}"><b>${esc(et.libelle)}</b><br><small>${et.atteinte ? esc(fmt(et.date)) : 'À venir'}</small></li>`
    ).join('');
    if (s.echec) html += `<li class="fail"><b>Échec de livraison</b><br><small>${esc(fmt(s.echec))}</small></li>`;
    $('#timeline').innerHTML = html;
  } catch (err) { toast(err.message, true); }
});

loadZones();
loadMine();
