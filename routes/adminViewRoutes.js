const express = require('express');
const validate = require('../middlewares/validate');
const { schemas } = require('../controller/ticketController');

const router = express.Router();

router.get('/reviews', (req, res) => res.render('admin/reviews'));
router.get('/tickets', (req, res) => res.render('admin/tickets'));
router.get('/tickets/:ticketId', validate(schemas.idParams, 'params'), (req, res) => {
  res.render('admin/ticket-detail', { ticketId: req.validated.params.ticketId });
});
router.get('/stats', (req, res) => res.render('admin/stats'));

module.exports = router;
