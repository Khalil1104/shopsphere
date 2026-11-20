require('dotenv').config();
const jwt = require('jsonwebtoken');

const role = process.argv[2] || 'client';
const id = process.argv[3] || '64b0000000000000000000a1';

console.log(jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '8h' }));
