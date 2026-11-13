/* ShopSphere Admin — Face ID / Windows Hello (WebAuthn) et CAPTCHA.
   La bibliothèque SimpleWebAuthnBrowser appelle navigator.credentials (API du navigateur). */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const lib = window.SimpleWebAuthnBrowser;
  const supported = Boolean(window.PublicKeyCredential && lib && lib.browserSupportsWebAuthn());

  async function postJson(url, body, headers) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.message || 'Erreur ' + res.status);
    return data;
  }

  function friendly(err) {
    if (err && err.name === 'NotAllowedError') return 'Opération annulée ou délai dépassé.';
    if (err && err.name === 'InvalidStateError') return 'Cet appareil est déjà enregistré.';
    if (err && err.name === 'SecurityError') return 'Ouvrez le tableau de bord avec l’adresse configurée dans APP_URL (ex. http://localhost:3001).';
    return (err && err.message) || 'Face ID indisponible.';
  }

  // ---------------------------------------------------------------- CAPTCHA : nouvelle image
  const refresh = $('[data-captcha-refresh]');
  if (refresh) {
    refresh.addEventListener('click', () => {
      $('[data-captcha]').src = '/admin/captcha.svg?t=' + Date.now();
      const input = $('input[name="captcha"]');
      input.value = '';
      input.focus();
    });
  }

  // ---------------------------------------------------------------- connexion Face ID
  const loginBtn = $('[data-faceid-login]');
  if (loginBtn && supported) {
    loginBtn.hidden = false;
    $('[data-faceid-divider]').hidden = false;
    const errorBox = $('[data-faceid-error]');
    const token = document.querySelector('meta[name="login-token"]').content;

    loginBtn.addEventListener('click', async () => {
      errorBox.hidden = true;
      loginBtn.disabled = true;
      try {
        const optionsJSON = await postJson('/admin/passkey/options', {}, { 'X-Login-Token': token });
        const response = await lib.startAuthentication({ optionsJSON });
        const result = await postJson('/admin/passkey/verify', { response, next: loginBtn.dataset.next }, { 'X-Login-Token': token });
        window.location.href = result.redirect || '/admin';
      } catch (err) {
        errorBox.textContent = friendly(err);
        errorBox.hidden = false;
        loginBtn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------- enregistrer cet appareil
  const registerBtn = $('[data-faceid-register]');
  if (registerBtn) {
    const errorBox = $('[data-faceid-register-error]');
    const show = (text) => {
      errorBox.textContent = text;
      errorBox.hidden = false;
    };
    if (!supported) {
      registerBtn.disabled = true;
      show('Ce navigateur ne prend pas en charge Face ID / Windows Hello.');
    } else if (registerBtn.dataset.wrongHost === 'true') {
      registerBtn.disabled = true;
      show('Face ID fonctionne seulement à l’adresse ' + registerBtn.dataset.url + '/admin');
    }

    registerBtn.addEventListener('click', async () => {
      errorBox.hidden = true;
      registerBtn.disabled = true;
      const csrf = document.querySelector('meta[name="csrf"]').content;
      try {
        const optionsJSON = await postJson('/admin/account/passkeys/options', {}, { 'X-CSRF-Token': csrf });
        const response = await lib.startRegistration({ optionsJSON });
        const name = $('[data-faceid-name]').value;
        await postJson('/admin/account/passkeys/verify', { response, name }, { 'X-CSRF-Token': csrf });
        window.location.reload();
      } catch (err) {
        show(friendly(err));
        registerBtn.disabled = false;
      }
    });
  }
})();
