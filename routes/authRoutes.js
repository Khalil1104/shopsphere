const express = require('express');
const { inscription, connexion } = require('../controller/authController');

const router = express.Router();

router.post('/inscription', inscription);
router.post('/connexion', connexion);

module.exports = router;
