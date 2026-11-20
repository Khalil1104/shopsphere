const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { verifierAuthentification, verifierRole } = require('../middlewares/fakeAuth');const validate = require('../middlewares/validate');
const controller = require('../controller/ticketController');

const router = express.Router();
const { schemas } = controller;
const auth = verifierAuthentification;
const client = verifierRole('client');
const admin = verifierRole('admin');

router.post('/', auth, client, validate(schemas.createSchema), asyncHandler(controller.creer));
router.get('/mes-tickets', auth, client, validate(schemas.pageSchema, 'query'), asyncHandler(controller.mesTickets));
router.get('/admin/stats', auth, admin, asyncHandler(controller.statistiques));
router.get('/admin', auth, admin, validate(schemas.pageSchema, 'query'), asyncHandler(controller.listeAdmin));
router.get('/admin/:ticketId', auth, admin, validate(schemas.idParams, 'params'), asyncHandler(controller.detailAdmin));
router.post('/admin/:ticketId/messages', auth, admin, validate(schemas.idParams, 'params'), validate(schemas.messageSchema), asyncHandler(controller.ajouterMessage));
router.patch('/admin/:ticketId', auth, admin, validate(schemas.idParams, 'params'), validate(schemas.updateSchema), asyncHandler(controller.modifierAdmin));
router.delete('/admin/:ticketId', auth, admin, validate(schemas.idParams, 'params'), asyncHandler(controller.supprimerAdmin));
router.get('/:ticketId', auth, client, validate(schemas.idParams, 'params'), asyncHandler(controller.voir));
router.post('/:ticketId/messages', auth, client, validate(schemas.idParams, 'params'), validate(schemas.messageSchema), asyncHandler(controller.ajouterMessage));

module.exports = router;
