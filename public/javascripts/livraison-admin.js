const NEXT = {
  en_preparation: ['expediee', 'echec'],
  expediee: ['en_transit', 'echec'],
  en_transit: ['livree', 'echec'],
  livree: [], echec: []
};
let couriers = [];
let page = 1;
let totalPages = 1;

async function loadStats() {
  const { data: s } = await api('/api/deliveries/stats/summary');
  const cards = [
    ['Total', s.total], ['En retard', s.enRetard], ['Délai moyen (jours)', s.delaiMoyenJours ?? '-'],
    ...Object.entries(s.parStatut).map(([k, v]) => [LIB[k] || k, v]),
    ...s.parGouvernorat.map((g) => [g.gouvernorat, g.count])
  ];
  $('#stats').innerHTML = cards.map(([k, v]) =>
    `<div class="stat"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('');
}

async function loadCouriers() {
  const { data } = await api('/api/couriers');
  couriers = data;
  $('#couriers').innerHTML = data.map((c) => `
    <tr><td>${esc(c.nom)}</td><td>${esc(c.telephone)}</td><td>${esc(c.maxLivraisonsParJour)}</td>
    <td><button class="danger" data-delc="${esc(c._id)}">Suppr.</button></td></tr>`).join('');
}

async function loadZones() {
  const { data } = await api('/api/zones');
  $('#zones').innerHTML = data.map((z) => `
    <tr><td>${esc(z.gouvernorat)}</td><td>${esc(z.frais)} TND</td><td>${esc(z.delaiJours)} j</td>
    <td>${z.seuilGratuit == null ? '-' : esc(z.seuilGratuit) + ' TND'}</td>
    <td><button class="danger" data-delz="${esc(z._id)}">Suppr.</button></td></tr>`).join('');
}

async function loadDeliveries() {
  const p = new URLSearchParams({ page, limit: 8 });
  if ($('#fSearch').value) p.set('search', $('#fSearch').value);
  if ($('#fStatut').value) p.set('statut', $('#fStatut').value);
  if ($('#fRetard').checked) p.set('enRetard', 'true');

  const r = await api('/api/deliveries?' + p.toString());
  totalPages = Math.max(r.totalPages, 1);
  $('#pageInfo').textContent = `Page ${r.page} / ${totalPages} (${r.total} livraison(s))`;
  $('#prev').disabled = r.page <= 1;
  $('#next').disabled = r.page >= totalPages;

  $('#rows').innerHTML = r.data.map((d) => {
    const late = ['en_preparation', 'expediee', 'en_transit'].includes(d.statut) && new Date(d.datePrevue) < new Date();
    const options = '<option value="">Affecter...</option>' + couriers.map((c) =>
      `<option value="${esc(c._id)}" ${d.courierId && d.courierId._id === c._id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('');
    const buttons = NEXT[d.statut].map((s) =>
      `<button class="${s === 'echec' ? 'danger' : ''}" data-id="${esc(d._id)}" data-status="${s}">${esc(LIB[s])}</button>`).join('');
    return `<tr>
      <td>${esc(String(d.orderId).slice(-8))}</td>
      <td>${esc(d.adresse.ville)}<br><small class="muted">${esc(d.adresse.gouvernorat)}</small></td>
      <td>${esc(d.frais)} TND</td>
      <td><select data-assign="${esc(d._id)}">${options}</select></td>
      <td><span class="badge st-${esc(d.statut)}">${esc(LIB[d.statut])}</span></td>
      <td class="${late ? 'late' : ''}">${esc(fmtDay(d.datePrevue))}${late ? ' (retard)' : ''}</td>
      <td><div class="btns">${buttons || '<span class="muted">Terminée</span>'}</div></td>
    </tr>`;
  }).join('');
}

async function refreshAll() {
  try {
    await loadCouriers();
    await Promise.all([loadStats(), loadZones(), loadDeliveries()]);
  } catch (e) { toast(e.message, true); }
}

$('#btnFilter').onclick = () => { page = 1; loadDeliveries().catch((e) => toast(e.message, true)); };
$('#prev').onclick = () => { page--; loadDeliveries(); };
$('#next').onclick = () => { page++; loadDeliveries(); };

$('#btnAlert').onclick = async () => {
  try {
    const r = await api('/api/deliveries/jobs/retards', { method: 'POST' });
    toast(r.message);
  } catch (e) { toast(e.message, true); }
};

$('#rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-status]');
  if (!btn) return;
  try {
    await api(`/api/deliveries/${btn.dataset.id}/status`, {
      method: 'PATCH', body: JSON.stringify({ statut: btn.dataset.status })
    });
    toast('Statut mis à jour');
    refreshAll();
  } catch (err) { toast(err.message, true); }
});

$('#rows').addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-assign]');
  if (!sel || !sel.value) return;
  try {
    await api(`/api/deliveries/${sel.dataset.assign}/assign`, {
      method: 'PATCH', body: JSON.stringify({ courierId: sel.value })
    });
    toast('Livreur affecté');
    loadDeliveries();
  } catch (err) { toast(err.message, true); loadDeliveries(); }
});

$('#btnZone').onclick = async () => {
  try {
    const body = {
      gouvernorat: $('#zGouv').value, frais: Number($('#zFrais').value), delaiJours: Number($('#zDelai').value)
    };
    if ($('#zSeuil').value !== '') body.seuilGratuit = Number($('#zSeuil').value);
    await api('/api/zones', { method: 'POST', body: JSON.stringify(body) });
    toast('Zone ajoutée');
    refreshAll();
  } catch (e) { toast(e.message, true); }
};

$('#zones').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-delz]');
  if (!btn || !confirm('Supprimer cette zone ?')) return;
  try { await api('/api/zones/' + btn.dataset.delz, { method: 'DELETE' }); refreshAll(); }
  catch (err) { toast(err.message, true); }
});

$('#btnCourier').onclick = async () => {
  try {
    const body = { nom: $('#cNom').value, telephone: $('#cTel').value };
    if ($('#cMax').value !== '') body.maxLivraisonsParJour = Number($('#cMax').value);
    await api('/api/couriers', { method: 'POST', body: JSON.stringify(body) });
    toast('Livreur ajouté');
    refreshAll();
  } catch (e) { toast(e.message, true); }
};

$('#couriers').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-delc]');
  if (!btn || !confirm('Supprimer ce livreur ?')) return;
  try { await api('/api/couriers/' + btn.dataset.delc, { method: 'DELETE' }); refreshAll(); }
  catch (err) { toast(err.message, true); }
});

refreshAll();

// ---------- IA : recherche en langage naturel ----------
$('#btnAiSearch').onclick = async () => {
  const question = $('#aiQuestion').value.trim();
  if (question.length < 3) return toast('Écrivez une demande (3 caractères minimum)', true);
  try {
    $('#btnAiSearch').disabled = true;
    const r = await api('/api/deliveries/ai/recherche', { method: 'POST', body: JSON.stringify({ question }) });
    const f = Object.entries(r.filtres).map(([k, v]) => `${k} = ${v}`).join(' · ') || 'aucun filtre';
    $('#aiFilters').textContent =
      `Interprétation (${r.source === 'ia' ? 'IA' : 'règles de secours'}) : ${f} — ${r.total} résultat(s)`;
    $('#aiRows').innerHTML = r.data.map((d) => `<tr>
      <td>${esc(String(d.orderId).slice(-8))}</td>
      <td>${esc(d.adresse.ville)}<br><small class="muted">${esc(d.adresse.gouvernorat)}</small></td>
      <td>${d.courierId ? esc(d.courierId.nom) : '<span class="muted">Non affecté</span>'}</td>
      <td><span class="badge st-${esc(d.statut)}">${esc(LIB[d.statut])}</span></td>
      <td>${esc(fmtDay(d.datePrevue))}</td></tr>`).join('') ||
      '<tr><td colspan="5" class="muted">Aucun résultat.</td></tr>';
  } catch (e) { toast(e.message, true); }
  finally { $('#btnAiSearch').disabled = false; }
};
$('#aiQuestion').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnAiSearch').click(); });

// ---------- IA : analyse et recommandations ----------
$('#btnAiAnalyse').onclick = async () => {
  try {
    $('#btnAiAnalyse').disabled = true;
    $('#aiAnalyse').innerHTML = '<p class="muted">Analyse en cours...</p>';
    const r = await api('/api/deliveries/ai/analyse');
    const a = r.analyse;
    $('#aiSource').textContent = r.source === 'ia' ? 'Généré par l\'IA' : 'Analyse par règles (IA non configurée)';
    $('#aiAnalyse').innerHTML =
      `<p><b>${esc(a.resume)}</b></p>` +
      '<h3>Alertes</h3><ul>' +
      a.alertes.map((x) => `<li class="alert-${esc(x.niveau)}">${esc(x.message)}</li>`).join('') + '</ul>' +
      '<h3>Recommandations</h3><ul>' +
      a.recommandations.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
  } catch (e) { $('#aiAnalyse').innerHTML = ''; toast(e.message, true); }
  finally { $('#btnAiAnalyse').disabled = false; }
};
