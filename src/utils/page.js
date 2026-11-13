'use strict';

/**
 * Petites pages HTML renvoyées quand l'utilisateur clique sur un lien d'e-mail
 * depuis son navigateur (vérification, nouveau mot de passe).
 * Postman / une application reçoivent du JSON à la place.
 */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function page(title, content, ok = true) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ShopSphere</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;font-family:Segoe UI,Arial,sans-serif;color:#0f172a}
  .card{background:#fff;border-radius:16px;padding:32px;width:min(420px,90vw);box-shadow:0 20px 50px rgba(0,0,0,.35)}
  .brand{font-weight:700;color:#2563eb;margin-bottom:12px}
  h1{font-size:22px;margin:0 0 10px;color:${ok ? '#065f46' : '#991b1b'}}
  p{line-height:1.6;color:#334155}
  label{display:block;font-size:14px;margin:14px 0 6px}
  input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px}
  button{margin-top:18px;width:100%;padding:12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  .hint{font-size:12px;color:#64748b}
</style></head><body><main class="card"><div class="brand">ShopSphere</div><h1>${esc(title)}</h1>${content}</main></body></html>`;
}

const message = (title, text, ok = true) => page(title, `<p>${esc(text)}</p>`, ok);

function resetForm(token, type, error) {
  return page(
    'Nouveau mot de passe',
    `${error ? `<p style="color:#991b1b">${esc(error)}</p>` : '<p>Choisissez votre nouveau mot de passe.</p>'}
    <form method="post" action="/api/auth/reset-password">
      <input type="hidden" name="token" value="${esc(token)}">
      <input type="hidden" name="type" value="${esc(type)}">
      <label for="p1">Nouveau mot de passe</label>
      <input id="p1" name="password" type="password" minlength="8" required autocomplete="new-password">
      <label for="p2">Confirmer le mot de passe</label>
      <input id="p2" name="confirmPassword" type="password" minlength="8" required autocomplete="new-password">
      <p class="hint">8 caractères minimum, avec une majuscule, une minuscule et un chiffre.</p>
      <button type="submit">Enregistrer</button>
    </form>`,
    !error
  );
}

/** true si la requête vient d'un navigateur (lien cliqué / formulaire), false pour Postman (JSON). */
const wantsHtml = (req) => req.accepts(['json', 'html']) === 'html';

module.exports = { message, resetForm, wantsHtml };
