require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { startDeliveryJobs } = require('./jobs/deliveryJobs');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Pages (Twig) : les données sont protégées par les API
app.get('/livraison', (req, res) => res.render('livraison/suivi'));
app.get('/admin/livraison', (req, res) => res.render('livraison/admin'));

// API du module 5
app.use('/api/zones', require('./routes/zones'));
app.use('/api/couriers', require('./routes/couriers'));
app.use('/api/deliveries', require('./routes/deliveries'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3005;

connectDB().then(() => {
  startDeliveryJobs();
  app.listen(PORT, () => console.log(`Module Livraison sur http://localhost:${PORT}`));
});
