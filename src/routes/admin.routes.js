'use strict';

const { Router } = require('express');
const clients = require('../controllers/client.controller');
const admins = require('../controllers/admin.controller');
const validate = require('../middlewares/validate');
const statsService = require('../services/statsService');
const Joi = require('joi');
const { authenticate, authorize } = require('../middlewares/auth');
const { clients: vc, admins: va } = require('../validators/schemas');

/** Toutes les routes /api/admin/* exigent un administrateur connecté. */
const router = Router();
router.use(authenticate, authorize('ADMIN'));

// --- Profil de l'admin connecté ---
router.get('/me', admins.getMe);
router.patch('/me', validate(va.updateMe), admins.updateMe);

// --- Statistiques ---
router.get('/stats', validate({ query: Joi.object({ days: Joi.number().integer().min(1).max(90).default(7) }) }), async (req, res) => {
  res.json(await statsService.overview(req.validated.query));
});

// --- CRUD clients ---
router.get('/clients', validate(vc.list), clients.list);
router.post('/clients', validate(vc.create), clients.create);
router.get('/clients/:id', validate(vc.byId), clients.getOne);
router.patch('/clients/:id', validate(vc.update), clients.update);
router.patch('/clients/:id/status', validate(vc.status), clients.updateStatus);
router.delete('/clients/:id', validate(vc.byId), clients.remove);

// --- CRUD admins ---
router.get('/admins', validate(va.list), admins.list);
router.post('/admins', validate(va.create), admins.create);
router.get('/admins/:id', validate(va.byId), admins.getOne);
router.patch('/admins/:id', validate(va.update), admins.update);
router.delete('/admins/:id', validate(va.byId), admins.remove);

module.exports = router;
