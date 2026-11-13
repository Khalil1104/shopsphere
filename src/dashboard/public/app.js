/* ShopSphere Admin — petites améliorations côté navigateur.
   Le dashboard fonctionne sans JavaScript ; ce fichier ajoute le glisser-déposer,
   les raccourcis et les confirmations. */
(function () {
  'use strict';

  const csrf = document.querySelector('meta[name="csrf"]')?.content;
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function toast(text, type = 'success') {
    const zone = document.getElementById('toastZone');
    if (!zone) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    zone.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // Messages de confirmation : disparaissent seuls
  $$('[data-toast]').forEach((t) => setTimeout(() => t.remove(), 6000));
  document.addEventListener('click', (e) => {
    const dismiss = e.target.closest('[data-dismiss]');
    if (dismiss) dismiss.closest('[data-toast]')?.remove();
  });

  // Lignes de tableau cliquables
  document.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a, button, form')) window.location.href = row.dataset.href;
  });

  // Tri : envoi automatique
  $$('[data-autosubmit]').forEach((el) => el.addEventListener('change', () => el.form.submit()));

  // Raccourci "/" : recherche
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || /input|textarea|select/i.test(document.activeElement.tagName)) return;
    const input = document.querySelector('.side-search input');
    if (input) { e.preventDefault(); input.focus(); }
  });

  // Menu mobile
  $$('[data-toggle-side]').forEach((b) => b.addEventListener('click', () => document.getElementById('side').classList.toggle('open')));

  // Formulaires repliables (ex. motif de suspension)
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    const close = e.target.closest('[data-close]');
    if (open) {
      const form = document.getElementById(open.dataset.open);
      form.hidden = false;
      form.querySelector('input:not([type=hidden])')?.focus();
    }
    if (close) document.getElementById(close.dataset.close).hidden = true;
  });

  // Actions destructrices : deuxième clic pour confirmer
  $$('form[data-confirm]').forEach((form) => {
    const btn = form.querySelector('button');
    const label = btn.innerHTML;
    let armed = false;
    form.addEventListener('submit', (e) => {
      if (armed) return;
      e.preventDefault();
      armed = true;
      btn.textContent = `${form.dataset.confirm} ?`;
      setTimeout(() => { armed = false; btn.innerHTML = label; }, 4000);
    });
  });

  // Tableau des clients : glisser-déposer
  const board = document.querySelector('[data-board]');
  if (board) {
    let dragged = null;
    const allowed = (lane) => {
      if (!dragged || !lane.dataset.drop) return false;
      const from = dragged.dataset.from;
      if (lane.dataset.drop === 'suspended') return from !== 'suspended';
      return from === 'suspended';
    };
    $$('.card', board).forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        dragged = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        $$('.lane', board).forEach((l) => l.classList.add(allowed(l) ? 'drop-ok' : 'drop-no'));
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        $$('.lane', board).forEach((l) => l.classList.remove('drop-ok', 'drop-no'));
      });
    });
    $$('.lane', board).forEach((lane) => {
      lane.addEventListener('dragover', (e) => { if (allowed(lane)) e.preventDefault(); });
      lane.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!allowed(lane)) return;
        const card = dragged;
        lane.querySelector('.lane-body').prepend(card);
        lane.querySelector('.lane-empty')?.remove();
        try {
          const res = await fetch(`/admin/clients/${card.dataset.card}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({ to: lane.dataset.drop })
          });
          const data = await res.json();
          toast(data.message, data.ok ? 'success' : 'error');
        } catch {
          toast('Action impossible, rechargez la page.', 'error');
        }
        setTimeout(() => window.location.reload(), 900);
      });
    });
    // Glisser vers "En attente" : expliquer pourquoi c'est impossible
    const waiting = board.querySelector('[data-lane="unverified"]');
    waiting?.addEventListener('dragenter', () => { if (dragged) toast("La vérification se fait par le client, via le lien reçu par e-mail.", 'error'); });
  }
})();
