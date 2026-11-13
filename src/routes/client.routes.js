'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/client.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { clients: v } = require('../validators/schemas');

/** Espace du client connecté : l'identité vient du JWT, jamais de l'URL. */
const router = Router();
router.use(authenticate, authorize('CUSTOMER'));

router.get('/me', ctrl.getMe);
router.patch('/me', validate(v.updateMe), ctrl.updateMe);
router.delete('/me', ctrl.deleteMe);

module.exports = router;
