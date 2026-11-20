require("dotenv").config();
const jwt = require("jsonwebtoken");

const users = {
  CLIENT_1: { id: "665f1a2b3c4d5e6f7a8b9c01", role: "client" },
  CLIENT_2: { id: "665f1a2b3c4d5e6f7a8b9c02", role: "client" },
  ADMIN: { id: "665f1a2b3c4d5e6f7a8b9c99", role: "admin" },
};

for (const [name, payload] of Object.entries(users)) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
  console.log(`${name}:\n${token}\n`);
}