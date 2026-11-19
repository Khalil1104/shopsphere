const express = require('express');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.set('view engine', 'twig');
app.set('views', path.join(__dirname, 'views'));

app.get('/health', (req, res) => {
  res.json({ message: 'ShopSphere fonctionne.' });
});

app.use('/api/auth', authRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
