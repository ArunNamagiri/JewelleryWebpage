const bcrypt = require("bcryptjs");

// ============================================================
// USAGE:
//   node src/scripts/hash-password.js "yourChosenPassword"
//
// Copy the printed hash into backend/.env as:
//   ADMIN_PASSWORD_HASH=<hash>
//
// The plain password is never stored anywhere — only this hash.
// ============================================================

const plainPassword = process.argv[2];

if (!plainPassword) {
    console.error("Usage: node src/scripts/hash-password.js \"yourChosenPassword\"");
    process.exit(1);
}

const hash = bcrypt.hashSync(plainPassword, 10);

console.log("\nAdd this to backend/.env :\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
