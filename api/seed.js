const pool = require("./db");
const bcrypt = require("bcryptjs");

(async () => {
  const hash = await bcrypt.hash("password123", 10);
  await pool.query("INSERT INTO users (username, password) VALUES (?, ?)", ["admin", hash]);
  console.log("user created");
  process.exit();
})();