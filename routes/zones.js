const express = require('express');
const ctrl = require('../controller/zoneController');
const validate = require('../middlewares/validate');
const { verifyToken, requireRole } = require('../middlewares/auth');
const v = require('../validators/livraison');

const router = express.Router();

// Public : le client consulte les zones et calcule ses frais
router.get('/', ctrl.list);
router.get('/frais', validate(v.fraisQuery, 'query'), ctrl.frais);

// Admin
router.post('/', verifyToken, requireRole('admin'), validate(v.zoneCreate), ctrl.create);
router.put('/:id', verifyToken, requireRole('admin'), validate(v.zoneUpdate), ctrl.update);
router.delete('/:id', verifyToken, requireRole('admin'), ctrl.remove);

module.exports = router;
