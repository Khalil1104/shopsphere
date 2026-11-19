const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');

const inscriptionSchema = Joi.object({
  nom: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Le nom est obligatoire.',
    'any.required': 'Le nom est obligatoire.'
  }),
  email: Joi.string().email().max(254).required().messages({
    'string.email': 'L’adresse e-mail est invalide.',
    'any.required': 'L’adresse e-mail est obligatoire.'
  }),
  motDePasse: Joi.string().min(8).max(72).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères.',
    'any.required': 'Le mot de passe est obligatoire.'
  })
});

const connexionSchema = Joi.object({
  email: Joi.string().email().required(),
  motDePasse: Joi.string().required()
});

function creerJeton(utilisateur) {
  if (!process.env.JWT_SECRET) {
    throw new Error('La variable JWT_SECRET est obligatoire.');
  }
  return jwt.sign(
    { role: utilisateur.role },
    process.env.JWT_SECRET,
    { subject: utilisateur.id, expiresIn: '12h' }
  );
}

function valider(schema, req, res) {
  const resultat = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (resultat.error) {
    res.status(400).json({
      message: resultat.error.details.map((detail) => detail.message).join(' ')
    });
    return null;
  }
  return resultat.value;
}

async function inscription(req, res, next) {
  const donnees = valider(inscriptionSchema, req, res);
  if (!donnees) return;

  try {
    const utilisateur = await User.creerAvecMotDePasse(donnees);
    return res.status(201).json({
      message: 'Compte créé.',
      token: creerJeton(utilisateur),
      utilisateur: { id: utilisateur.id, nom: utilisateur.nom, email: utilisateur.email, role: utilisateur.role }
    });
  } catch (error) {
    return next(error);
  }
}

async function connexion(req, res, next) {
  const donnees = valider(connexionSchema, req, res);
  if (!donnees) return;

  try {
    const utilisateur = await User.findOne({ email: donnees.email.toLowerCase() }).select('+passwordHash');
    if (!utilisateur || !(await utilisateur.verifierMotDePasse(donnees.motDePasse))) {
      return res.status(401).json({ message: 'Adresse e-mail ou mot de passe incorrect.' });
    }
    return res.json({
      message: 'Connexion réussie.',
      token: creerJeton(utilisateur),
      utilisateur: { id: utilisateur.id, nom: utilisateur.nom, email: utilisateur.email, role: utilisateur.role }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { inscription, connexion };
