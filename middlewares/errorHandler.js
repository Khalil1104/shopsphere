class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const notFound = (req, res, next) => {
  next(new AppError(`Route introuvable : ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Erreur interne du serveur';

  if (err.name === 'CastError') { status = 400; message = 'Identifiant invalide'; }
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }
  if (err.code === 11000) { status = 409; message = 'Cette valeur existe déjà (doublon)'; }
  if (status === 500) console.error(err);

  res.status(status).json({ message });
};

module.exports = { AppError, notFound, errorHandler };
