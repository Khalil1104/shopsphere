const tokenKey = 'shopsphereAdminToken';
const tokenInput = document.querySelector('#token');
const messageBox = document.querySelector('#message');
const page = document.body.dataset.page;
let token = sessionStorage.getItem(tokenKey) || '';
let currentPage = 1;
const pageLimit = 20;

tokenInput.value = token;

function message(texte) {
  messageBox.textContent = texte;
}

function cellule(texte) {
  const td = document.createElement('td');
  td.textContent = texte == null ? '' : String(texte);
  return td;
}

function bouton(texte, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = texte;
  button.addEventListener('click', action);
  return button;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const donnees = await response.json();
  if (!response.ok) throw new Error(donnees.message || `Erreur HTTP ${response.status}`);
  return donnees;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

document.querySelector('#tokenForm').addEventListener('submit', (event) => {
  event.preventDefault();
  token = tokenInput.value.trim();
  sessionStorage.setItem(tokenKey, token);
  message('Jeton enregistré dans cette session.');
  charger();
});

async function chargerAvis() {
  const params = new URLSearchParams({ page: String(currentPage), limit: String(pageLimit) });
  for (const [key, value] of Object.entries(formValues(document.querySelector('#filters')))) {
    if (value) params.set(key, value);
  }
  const donnees = await api(`/api/reviews/admin?${params}`);
  const rows = document.querySelector('#rows');
  rows.replaceChildren();
  for (const avis of donnees.avis) {
    const tr = document.createElement('tr');
    tr.append(
      cellule(avis.productId?.nom),
      cellule(avis.clientId?.nom),
      cellule(avis.note),
      cellule(avis.commentaire),
      cellule(avis.statut)
    );
    const actions = document.createElement('td');
    if (avis.statut !== 'valide') {
      actions.append(bouton('Valider', () => modererAvis(avis._id, 'valide')));
    }
    if (avis.statut !== 'masque') {
      actions.append(bouton('Masquer', () => modererAvis(avis._id, 'masque')));
    }
    tr.append(actions);
    rows.append(tr);
  }
  afficherPagination(donnees.pagination);
}

async function modererAvis(id, statut) {
  await api(`/api/reviews/${id}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify({ statut })
  });
  await chargerAvis();
}

async function chargerTickets() {
  const params = new URLSearchParams({ page: String(currentPage), limit: String(pageLimit) });
  for (const [key, value] of Object.entries(formValues(document.querySelector('#filters')))) {
    if (value) params.set(key, value);
  }
  const donnees = await api(`/api/tickets/admin?${params}`);
  const rows = document.querySelector('#rows');
  rows.replaceChildren();
  for (const ticket of donnees.tickets) {
    const tr = document.createElement('tr');
    const detail = document.createElement('td');
    const link = document.createElement('a');
    link.href = `/admin/tickets/${ticket._id}`;
    link.textContent = 'Ouvrir';
    detail.append(link);
    tr.append(
      cellule(ticket.sujet),
      cellule(ticket.clientId?.nom),
      cellule(ticket.priorite),
      cellule(ticket.statut),
      cellule(new Date(ticket.dernierMessageLe).toLocaleString('fr-FR')),
      detail
    );
    rows.append(tr);
  }
  afficherPagination(donnees.pagination);
}

function afficherPagination(pagination) {
  document.querySelector('#pagination').textContent =
    `Page ${pagination.page} · ${pagination.total} résultat(s)`;
  document.querySelector('#previous').disabled = pagination.page <= 1;
  document.querySelector('#next').disabled = pagination.page * pagination.limit >= pagination.total;
}

async function chargerDetailTicket() {
  const id = document.body.dataset.ticketId;
  const { ticket } = await api(`/api/tickets/admin/${id}`);
  document.querySelector('#subject').textContent = ticket.sujet;
  document.querySelector('#metadata').textContent =
    `Client : ${ticket.clientId?.nom || ''} · Priorité : ${ticket.priorite} · Statut : ${ticket.statut}`;
  document.querySelector('[name="priorite"]').value = ticket.priorite;
  document.querySelector('[name="statut"]').value = ticket.statut;
  const list = document.querySelector('#messages');
  list.replaceChildren();
  for (const item of ticket.messages) {
    const li = document.createElement('li');
    li.textContent = `${item.auteurRole} · ${new Date(item.createdAt).toLocaleString('fr-FR')} : ${item.texte}`;
    list.append(li);
  }
}

async function chargerStats() {
  const [avis, tickets] = await Promise.all([
    api('/api/reviews/admin/stats'),
    api('/api/tickets/admin/stats')
  ]);
  const list = document.querySelector('#reviewStats');
  list.replaceChildren();
  for (const produit of avis.parProduit) {
    const li = document.createElement('li');
    li.textContent = `${produit.nomProduit || 'Produit'} : ${produit.noteMoyenne}/5 (${produit.nombreAvis} avis)`;
    list.append(li);
  }
  document.querySelector('#ticketStats').textContent =
    `${tickets.ticketsOuverts} ticket(s) ouvert(s) · Délai moyen de première réponse : ${
      tickets.delaiMoyenReponseHeures == null ? 'indisponible' : `${tickets.delaiMoyenReponseHeures} h`
    }`;
}

async function charger() {
  try {
    message('');
    if (page === 'reviews') await chargerAvis();
    if (page === 'tickets') await chargerTickets();
    if (page === 'ticket-detail') await chargerDetailTicket();
    if (page === 'stats') await chargerStats();
  } catch (error) {
    message(error.message);
  }
}

if (page === 'reviews' || page === 'tickets') {
  document.querySelector('#filters').addEventListener('submit', (event) => {
    event.preventDefault();
    currentPage = 1;
    charger();
  });
  document.querySelector('#previous').addEventListener('click', () => {
    currentPage -= 1;
    charger();
  });
  document.querySelector('#next').addEventListener('click', () => {
    currentPage += 1;
    charger();
  });
}

if (page === 'ticket-detail') {
  document.querySelector('#ticketUpdate').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/api/tickets/admin/${document.body.dataset.ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(formValues(event.currentTarget))
      });
      await chargerDetailTicket();
      message('Ticket modifié.');
    } catch (error) {
      message(error.message);
    }
  });
  document.querySelector('#reply').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/api/tickets/admin/${document.body.dataset.ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify(formValues(event.currentTarget))
      });
      event.currentTarget.reset();
      await chargerDetailTicket();
      message('Réponse envoyée.');
    } catch (error) {
      message(error.message);
    }
  });
  document.querySelector('#deleteTicket').addEventListener('click', async () => {
    try {
      await api(`/api/tickets/admin/${document.body.dataset.ticketId}`, { method: 'DELETE' });
      window.location.assign('/admin/tickets');
    } catch (error) {
      message(error.message);
    }
  });
}

if (token) charger();
