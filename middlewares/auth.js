const jwt = require('jsonwebtoken');

function verifierAuthentification(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const [type, token] = authorization.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'La configuration du serveur est incomplète.' });
    }

    const payload = jwt.verify(token, secret);
    if (!payload.sub || !['client', 'admin'].includes(payload.role)) {
      return res.status(401).json({ message: 'Jeton invalide.' });
    }
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Jeton invalide ou expiré.' });
    }
    return next(error);
  }
}

function verifierRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentification requise.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès interdit.' });
    }
    return next();
  };
}

module.exports = { verifierAuthentification, verifierRole };
