'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const ejs = require('ejs');
const Joi = require('joi');

const config = require('../config/env');
const AppError = require('../utils/AppError');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const authService = require('../services/authService');
const clientService = require('../services/clientService');
const adminService = require('../services/adminService');
const sessionService = require('../services/sessionService');
const statsService = require('../services/statsService');
const automations = require('../automations');
const schemas = require('../validators/schemas');
const helpers = require('./helpers');
const charts = require('./charts');
const { setSessionCookie, clearSessionCookie, flash, readFlash, requireAdmin, checkCsrf, sameToken } = require('./session');

/**
 * Tableau de bord administrateur, rendu côté serveur (Express + EJS).
 * Il appelle directement les services de l'API : aucune logique dupliquée.
 */
const router = express.Router();
const VIEWS = path.join(__dirname, 'views');
const SOON = {
  orders: { title: 'Commandes', text: "La gestion des commandes arrivera avec l'Order Service. Les clients non vérifiés ne pourront pas commander." },
  products: { title: 'Produits', text: 'Le catalogue sera relié au Catalog Service.' },
  categories: { title: 'Catégories', text: 'Les catégories seront gérées par le Catalog Service.' },
  payments: { title: 'Paiements', text: 'Les paiements seront reliés au Payment Service.' },
  inventory: { title: 'Stock', text: "Le suivi du stock viendra de l'Inventory Service." }
};

// --------------------------------------------------------------------------- utilitaires
async function render(req, res, view, locals = {}, { layout = true, status = 200 } = {}) {
  const data = { ...res.locals, h: helpers, charts, path: req.path, query: req.query, theme: req.cookies.ss_theme === 'light' ? 'light' : 'dark', title: '', ...locals };
  const body = await ejs.renderFile(path.join(VIEWS, `${view}.ejs`), data);
  const html = layout ? await ejs.renderFile(path.join(VIEWS, 'layout.ejs'), { ...data, body }) : body;
  res.status(status).send(html);
}

/** Valide un formulaire avec les schémas Joi de l'API. Les champs vides optionnels sont ignorés. */
function formData(schema, body, keepEmpty = []) {
  const data = {};
  for (const [k, v] of Object.entries(body || {})) {
    const value = typeof v === 'string' ? v.trim() : v;
    if (value !== '' || keepEmpty.includes(k)) data[k] = value;
  }
  const { value, error } = schema.validate(data, { abortEarly: false, errors: { wrap: { label: '' } } });
  if (error) throw AppError.badRequest(error.details.map((d) => d.message).join(' · '));
  return value;
}

/** Exécute une action de formulaire, affiche un message et redirige. */
const action = (fn, fallback) => async (req, res) => {
  try {
    const result = await fn(req, res);
    if (result && result.redirect) {
      if (result.message) flash(res, 'success', result.message);
      return res.redirect(result.redirect);
    }
    return undefined;
  } catch (err) {
    if (!(err instanceof AppError) && err.code !== 11000) throw err;
    const message = err.code === 11000 ? (Object.keys(err.keyPattern || {})[0] === 'cin' ? 'Ce CIN est déjà utilisé' : 'Cette adresse e-mail est déjà utilisée') : err.message;
    flash(res, 'error', message);
    return res.redirect(typeof fallback === 'function' ? fallback(req) : fallback || req.get('referer') || '/admin');
  }
};

const isId = (id) => /^[a-f0-9]{24}$/.test(id);

// --------------------------------------------------------------------------- statiques + connexion
router.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: config.env === 'production' ? '1d' : 0 }));
router.use(readFlash);

router.get('/theme', (req, res) => {
  res.cookie('ss_theme', req.query.to === 'light' ? 'light' : 'dark', { path: '/admin', sameSite: 'strict', maxAge: 365 * 86400000 });
  const back = String(req.query.back || '/admin');
  res.redirect(back.startsWith('/admin') ? back : '/admin');
});

router.get('/login', (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  res.cookie('ss_login', token, { httpOnly: true, sameSite: 'strict', path: '/admin' });
  return render(req, res, 'login', { loginCsrf: token, next: req.query.next || '/admin', email: '' }, { layout: false });
});

router.post('/login', async (req, res) => {
  const nextUrl = String(req.body.next || '/admin').startsWith('/admin') ? String(req.body.next || '/admin') : '/admin';
  const again = (message, status) => {
    const token = crypto.randomBytes(16).toString('hex');
    res.cookie('ss_login', token, { httpOnly: true, sameSite: 'strict', path: '/admin' });
    return render(req, res, 'login', { loginCsrf: token, next: nextUrl, email: req.body.email || '', error: message }, { layout: false, status });
  };
  if (!sameToken(req.body._csrf, req.cookies.ss_login)) return again('Session de connexion expirée, réessayez.', 403);
  try {
    const { email, password } = formData(schemas.auth.login.body, { email: req.body.email, password: req.body.password });
    const { token, expiresAt } = await authService.login('admin', { email, password }, { ip: req.ip, userAgent: req.get('user-agent') });
    res.clearCookie('ss_login', { path: '/admin' });
    setSessionCookie(res, token, expiresAt);
    return res.redirect(nextUrl);
  } catch (err) {
    if (err instanceof AppError) return again(err.status === 400 ? 'Saisissez une adresse e-mail et un mot de passe valides.' : err.message, err.status);
    throw err;
  }
});

// --------------------------------------------------------------------------- zone protégée
router.use(requireAdmin, checkCsrf);

// Compteurs de la barre latérale
router.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const [unverified, suspended] = await Promise.all([
    Client.countDocuments({ isEmailVerified: false, accountStatus: 'ACTIVE' }),
    Client.countDocuments({ accountStatus: 'SUSPENDED' })
  ]);
  res.locals.nav = { unverified, suspended, automationsOn: automations.list().filter((a) => a.enabled).length };
  return next();
});

router.post('/logout', async (req, res) => {
  await sessionService.close(req.auth.id, 'admin', req.auth.sid).catch(() => {});
  clearSessionCookie(res);
  res.redirect('/admin/login');
});

// --- Vue d'ensemble -------------------------------------------------------------------
router.get('/', async (req, res) => {
  const days = req.query.range === '30' ? 30 : 7;
  const [stats, recent, toWatch, staleUnverified] = await Promise.all([
    statsService.overview({ days }),
    Client.find().sort({ createdAt: -1 }).limit(6),
    Client.find({ accountStatus: 'SUSPENDED' }).sort({ updatedAt: -1 }).limit(4),
    Client.find({ isEmailVerified: false, accountStatus: 'ACTIVE', createdAt: { $lte: new Date(Date.now() - 86400000) } }).sort({ createdAt: 1 }).limit(4)
  ]);
  const week = days === 7 ? stats.registrationsPerDay : stats.registrationsPerDay.slice(-7);
  return render(req, res, 'overview', {
    title: "Vue d'ensemble",
    stats,
    days,
    week,
    recent,
    toWatch,
    staleUnverified,
    tasks: automations.list(),
    lastRuns: automations.history().slice(0, 4)
  });
});

// --- Clients : liste ------------------------------------------------------------------
router.get('/clients', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 12;
  const filter = {};
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }, { cin: rx }, { city: rx }];
  }
  const view = ['verified', 'unverified', 'suspended'].includes(req.query.view) ? req.query.view : 'all';
  if (view === 'verified') Object.assign(filter, { isEmailVerified: true, accountStatus: 'ACTIVE' });
  if (view === 'unverified') Object.assign(filter, { isEmailVerified: false, accountStatus: 'ACTIVE' });
  if (view === 'suspended') filter.accountStatus = 'SUSPENDED';
  const sorts = { recent: { createdAt: -1 }, name: { lastName: 1, firstName: 1 }, login: { lastLoginAt: -1 } };
  const sort = sorts[req.query.sort] ? req.query.sort : 'recent';

  const [items, total, counts] = await Promise.all([
    Client.find(filter).sort(sorts[sort]).skip((page - 1) * limit).limit(limit),
    Client.countDocuments(filter),
    Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ isEmailVerified: true, accountStatus: 'ACTIVE' }),
      Client.countDocuments({ isEmailVerified: false, accountStatus: 'ACTIVE' }),
      Client.countDocuments({ accountStatus: 'SUSPENDED' })
    ])
  ]);
  return render(req, res, 'clients', {
    title: 'Clients',
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    q,
    view,
    sort,
    counts: { all: counts[0], verified: counts[1], unverified: counts[2], suspended: counts[3] }
  });
});

// --- Clients : tableau (kanban) ---------------------------------------------------------
router.get('/clients/board', async (req, res) => {
  const [unverified, verified, suspended] = await Promise.all([
    Client.find({ isEmailVerified: false, accountStatus: 'ACTIVE' }).sort({ createdAt: -1 }).limit(40),
    Client.find({ isEmailVerified: true, accountStatus: 'ACTIVE' }).sort({ lastLoginAt: -1, createdAt: -1 }).limit(40),
    Client.find({ accountStatus: 'SUSPENDED' }).sort({ updatedAt: -1 }).limit(40)
  ]);
  return render(req, res, 'board', { title: 'Tableau des clients', columns: { unverified, verified, suspended } });
});

/** Déplacement d'une carte du tableau : vers "suspended" (suspendre) ou "active" (réactiver). */
router.post('/clients/:id/move', async (req, res) => {
  const wantsJson = req.is('application/json');
  try {
    if (!isId(req.params.id)) throw AppError.badRequest('Identifiant invalide');
    const to = req.body.to === 'suspended' ? 'SUSPENDED' : req.body.to === 'active' ? 'ACTIVE' : null;
    if (!to) throw AppError.badRequest('Déplacement non autorisé');
    const client = await clientService.updateStatus(req.params.id, { status: to, reason: to === 'SUSPENDED' ? 'Suspendu depuis le tableau des clients' : undefined });
    const message = to === 'SUSPENDED' ? `${client.firstName} ${client.lastName} est suspendu. E-mail envoyé.` : `${client.firstName} ${client.lastName} est réactivé. E-mail envoyé.`;
    if (wantsJson) return res.json({ ok: true, message });
    flash(res, 'success', message);
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    if (wantsJson) return res.status(err.status).json({ ok: false, message: err.message });
    flash(res, 'error', err.message);
  }
  return res.redirect('/admin/clients/board');
});

// --- Clients : création -----------------------------------------------------------------
router.get('/clients/new', (req, res) => render(req, res, 'client-new', { title: 'Nouveau client', values: {} }));

router.post(
  '/clients',
  action(async (req) => {
    const data = formData(schemas.clients.create.body, req.body, ['address', 'city']);
    const client = await clientService.create(data);
    return { redirect: `/admin/clients/${client._id}`, message: 'Client créé. E-mails de bienvenue et de vérification envoyés.' };
  }, '/admin/clients/new')
);

// --- Clients : fiche --------------------------------------------------------------------
router.get('/clients/:id', async (req, res, next) => {
  if (!isId(req.params.id)) return next();
  const client = await Client.findById(req.params.id).select('+sessions +failedLoginAttempts');
  if (!client) return next();
  const sessions = (client.sessions || []).filter((s) => s.expiresAt > new Date()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  return render(req, res, 'client', { title: `${client.firstName} ${client.lastName}`, client, sessions });
});

const back = (req) => `/admin/clients/${req.params.id}`;

router.post(
  '/clients/:id',
  action(async (req) => {
    const data = formData(schemas.clients.update.body, req.body, ['address', 'city']);
    await clientService.update(req.params.id, data);
    return { redirect: back(req), message: 'Informations enregistrées.' };
  }, back)
);

router.post(
  '/clients/:id/status',
  action(async (req) => {
    const { status, reason } = formData(schemas.clients.status.body, req.body, ['reason']);
    const client = await clientService.updateStatus(req.params.id, { status, reason });
    return { redirect: back(req), message: status === 'SUSPENDED' ? `Compte suspendu, ${client.email} a été prévenu.` : `Compte réactivé, ${client.email} a été prévenu.` };
  }, back)
);

router.post(
  '/clients/:id/resend',
  action(async (req) => {
    const client = await clientService.getById(req.params.id);
    if (client.isEmailVerified) throw AppError.badRequest('Cette adresse est déjà vérifiée.');
    await authService.resendVerification(client.email);
    return { redirect: back(req), message: `Nouveau lien de vérification envoyé à ${client.email}.` };
  }, back)
);

router.post(
  '/clients/:id/sessions/:sid/delete',
  action(async (req) => {
    await sessionService.close(req.params.id, 'client', req.params.sid);
    return { redirect: back(req), message: 'Appareil déconnecté.' };
  }, back)
);

router.post(
  '/clients/:id/sessions/delete-all',
  action(async (req) => {
    const n = await sessionService.closeAll(req.params.id, 'client');
    return { redirect: back(req), message: `${helpers.plural(n, 'session fermée', 'sessions fermées')}.` };
  }, back)
);

router.post(
  '/clients/:id/delete',
  action(async (req) => {
    const client = await clientService.getById(req.params.id);
    await clientService.remove(req.params.id);
    return { redirect: '/admin/clients', message: `Le compte de ${client.firstName} ${client.lastName} a été supprimé.` };
  }, back)
);

// --- Administrateurs --------------------------------------------------------------------
router.get('/admins', async (req, res) => {
  const items = await Admin.find().select('+sessions').sort({ createdAt: 1 });
  return render(req, res, 'admins', { title: 'Administrateurs', items });
});

router.get('/admins/new', (req, res) => render(req, res, 'admin-new', { title: 'Nouvel administrateur' }));

router.post(
  '/admins',
  action(async (req) => {
    const data = formData(schemas.admins.create.body, req.body);
    const admin = await adminService.create(data);
    return { redirect: `/admin/admins/${admin._id}`, message: `Administrateur ${admin.email} créé.` };
  }, '/admin/admins/new')
);

router.get('/admins/:id', async (req, res, next) => {
  if (!isId(req.params.id)) return next();
  const admin = await Admin.findById(req.params.id).select('+sessions');
  if (!admin) return next();
  const sessions = (admin.sessions || []).filter((s) => s.expiresAt > new Date()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  return render(req, res, 'admin', { title: `${admin.firstName} ${admin.lastName}`, admin, sessions, isMe: String(admin._id) === req.auth.id });
});

const backAdmin = (req) => `/admin/admins/${req.params.id}`;

router.post(
  '/admins/:id',
  action(async (req) => {
    const data = formData(schemas.admins.update.body.fork(['accountStatus'], (s) => s.forbidden()), req.body);
    await adminService.update(req.params.id, data, req.auth.id);
    return { redirect: backAdmin(req), message: 'Informations enregistrées.' };
  }, backAdmin)
);

router.post(
  '/admins/:id/status',
  action(async (req) => {
    const { status } = formData(Joi.object({ status: Joi.string().valid('ACTIVE', 'SUSPENDED').required() }), req.body);
    await adminService.update(req.params.id, { accountStatus: status }, req.auth.id);
    return { redirect: backAdmin(req), message: status === 'SUSPENDED' ? 'Administrateur suspendu, ses sessions sont fermées.' : 'Administrateur réactivé.' };
  }, backAdmin)
);

router.post(
  '/admins/:id/delete',
  action(async (req) => {
    await adminService.remove(req.params.id, req.auth.id);
    return { redirect: '/admin/admins', message: 'Administrateur supprimé.' };
  }, backAdmin)
);

// --- Automations ------------------------------------------------------------------------
router.get('/automations', (req, res) => render(req, res, 'automations', { title: 'Automations', tasks: automations.list(), history: automations.history().slice(0, 20) }));

router.post(
  '/automations/:key/toggle',
  action(async (req) => {
    if (!automations.exists(req.params.key)) throw AppError.notFound('Automation inconnue');
    const on = req.body.enabled === 'true';
    automations.setEnabled(req.params.key, on);
    return { redirect: '/admin/automations', message: on ? 'Automation activée.' : 'Automation désactivée.' };
  }, '/admin/automations')
);

router.post(
  '/automations/:key/run',
  action(async (req) => {
    if (!automations.exists(req.params.key)) throw AppError.notFound('Automation inconnue');
    const run = await automations.run(req.params.key, { by: `${req.admin.firstName} ${req.admin.lastName}` });
    if (run.status === 'error') throw AppError.badRequest(`Échec : ${run.summary}`);
    return { redirect: '/admin/automations', message: `${run.name} : ${run.summary}.` };
  }, '/admin/automations')
);

// --- Mon compte -------------------------------------------------------------------------
router.get('/account', async (req, res) => {
  const sessions = (req.admin.sessions || []).filter((s) => s.expiresAt > new Date()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  return render(req, res, 'account', { title: 'Mon compte', sessions, currentSid: req.auth.sid });
});

router.post(
  '/account',
  action(async (req) => {
    const data = formData(schemas.admins.updateMe.body, req.body);
    await adminService.update(req.auth.id, data, req.auth.id);
    return { redirect: '/admin/account', message: 'Profil enregistré.' };
  }, '/admin/account')
);

router.post(
  '/account/sessions/:sid/delete',
  action(async (req) => {
    if (req.params.sid === req.auth.sid) throw AppError.badRequest('Pour fermer cette session, utilisez « Se déconnecter ».');
    await sessionService.close(req.auth.id, 'admin', req.params.sid);
    return { redirect: '/admin/account', message: 'Appareil déconnecté.' };
  }, '/admin/account')
);

router.post('/account/logout-all', async (req, res) => {
  await sessionService.closeAll(req.auth.id, 'admin');
  clearSessionCookie(res);
  res.redirect('/admin/login');
});

// --- Modules à venir --------------------------------------------------------------------
router.get('/soon/:section', (req, res, next) => {
  const section = SOON[req.params.section];
  if (!section) return next();
  return render(req, res, 'soon', { title: section.title, section, key: req.params.section });
});

// --- 404 et erreurs du dashboard --------------------------------------------------------
router.use((req, res) => render(req, res, 'not-found', { title: 'Page introuvable' }, { status: 404 }));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
  if (!config.isTest) console.error(err);
  res.status(500).send('Une erreur interne est survenue. Réessayez ou consultez la console du serveur.');
});

module.exports = { router, SOON };
