const ID_CLIENT = '000000000000000000000001';
const ID_ADMIN = '000000000000000000000002';

// TEMPORAIRE : remplace la connexion pendant les tests Postman.
// Admin si l'en-tête x-role OU le paramètre ?role contient "admin". Sinon : client.
function verifierAuthentification(req, res, next) {
  const brut = String(req.headers['x-role'] || req.query.role || '');
  const role = brut.toLowerCase().includes('admin') ? 'admin' : 'client';
  const id = role === 'admin' ? ID_ADMIN : ID_CLIENT;
  req.user = { id, _id: id, role };
  console.log('FAKE AUTH :', req.method, req.originalUrl, '-> role =', role);
  next();
}

function verifierRole(...rolesAutorises) {
  return (req, res, next) => {
    if (!rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    next();
  };
}

module.exports = { verifierAuthentification, verifierRole };