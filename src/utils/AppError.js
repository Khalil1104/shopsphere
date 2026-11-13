'use strict';

/**
 * Erreur "prévue" : son message est renvoyé tel quel au client.
 * Exemple : throw AppError.notFound('Client introuvable')  →  404 { code, message }
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Authentification requise') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'Accès refusé') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Ressource introuvable') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message) {
    return new AppError(409, 'CONFLICT', message);
  }
}

module.exports = AppError;
