const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { verifierAuthentification, verifierRole } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const controller = require('../controller/reviewController');

const router = express.Router();
const { schemas } = controller;
const pagination = validate(schemas.pageSchema, 'query');

router.get('/produit/:productId', validate(schemas.productParams, 'params'), pagination, asyncHandler(controller.avisPublics));
router.get('/mes-avis', verifierAuthentification, verifierRole('client'), pagination, asyncHandler(controller.mesAvis));
router.post('/', verifierAuthentification, verifierRole('client'), validate(schemas.createSchema), asyncHandler(controller.creer));
router.get('/admin/stats', verifierAuthentification, verifierRole('admin'), asyncHandler(controller.statistiques));
router.get('/admin', verifierAuthentification, verifierRole('admin'), validate(schemas.adminQuerySchema, 'query'), asyncHandler(controller.listeAdmin));
router.patch('/:reviewId/moderation', verifierAuthentification, verifierRole('admin'), validate(schemas.idParams, 'params'), validate(schemas.moderationSchema), asyncHandler(controller.moderer));
router.patch('/:reviewId', verifierAuthentification, verifierRole('client'), validate(schemas.idParams, 'params'), validate(schemas.updateSchema), asyncHandler(controller.modifier));
router.delete('/:reviewId', verifierAuthentification, verifierRole('client'), validate(schemas.idParams, 'params'), asyncHandler(controller.supprimer));

module.exports = router;
