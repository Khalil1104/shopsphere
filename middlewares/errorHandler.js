function notFound(req, res, next) {
  res.status(404).json({ message: 'Ressource introuvable.' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'Cette valeur existe déjà.' });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Les données fournies sont invalides.' });
  }
  console.error(error);
  return res.status(500).json({ message: 'Une erreur interne est survenue.' });
}

module.exports = { notFound, errorHandler };
