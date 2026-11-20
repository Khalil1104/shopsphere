const express = require('express');
const ctrl = require('../controller/courierController');
const validate = require('../middlewares/validate');
const { verifyToken, requireRole } = require('../middlewares/auth');
const v = require('../validators/livraison');

const router = express.Router();
router.use(verifyToken, requireRole('admin'));

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', validate(v.courierCreate), ctrl.create);
router.put('/:id', validate(v.courierUpdate), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
