'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet()); // en-têtes de sécurité
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' })); // formulaires (mot de passe, dashboard)
  app.use(cookieParser());
  if (!config.isTest) app.use(morgan('dev')); // log de chaque requête dans la console

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', require('./routes/auth.routes'));
  app.use('/api/clients', require('./routes/client.routes'));
  app.use('/api/admin', require('./routes/admin.routes'));
  app.use('/admin', require('./dashboard/router').router); // tableau de bord (rendu côté serveur)
  app.get('/', (_req, res) => res.redirect('/admin'));

  app.use(notFound);
  app.use(errorHandler); // toujours en dernier
  return app;
}

module.exports = { createApp };
