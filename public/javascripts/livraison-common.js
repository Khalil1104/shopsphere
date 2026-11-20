const $ = (s, root = document) => root.querySelector(s);

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '-');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '-');

const LIB = {
  en_preparation: 'En préparation', expediee: 'Expédiée',
  en_transit: 'En transit', livree: 'Livrée', echec: 'Échec'
};

function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = isError ? 'error' : '';
  t.style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.style.display = 'none'), 3500);
}

async function api(path, opts = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || 'Erreur ' + res.status);
  return body;
}

$('#token').value = localStorage.getItem('token') || '';
$('#saveToken').onclick = () => {
  localStorage.setItem('token', $('#token').value.trim());
  location.reload();
};
