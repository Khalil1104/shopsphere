const express = require('express');
const ctrl = require('../controller/deliveryController');
const ai = require('../controller/aiController');
const validate = require('../middlewares/validate');
const { verifyToken, requireRole } = require('../middlewares/auth');
const v = require('../validators/livraison');

const router = express.Router();
router.use(verifyToken);

// Client
router.post('/', requireRole('client'), validate(v.deliveryCreate), ctrl.create);
router.get('/me', requireRole('client'), ctrl.mine);

// Admin : les routes fixes AVANT /:id
router.get('/stats/summary', requireRole('admin'), ctrl.stats);
router.get('/ai/analyse', requireRole('admin'), ai.analyse);
router.post('/ai/recherche', requireRole('admin'), validate(v.aiSearch), ai.recherche);
router.post('/jobs/retards', requireRole('admin'), ctrl.runLateAlert);
router.get('/', requireRole('admin'), validate(v.listQuery, 'query'), ctrl.list);

// Suivi : propriétaire ou admin (contrôle dans le contrôleur)
router.get('/:id/suivi', ctrl.suivi);

router.get('/:id', requireRole('admin'), ctrl.getOne);
router.patch('/:id/assign', requireRole('admin'), validate(v.assignSchema), ctrl.assign);
router.patch('/:id/status', requireRole('admin'), validate(v.statusSchema), ctrl.updateStatus);

module.exports = router;
