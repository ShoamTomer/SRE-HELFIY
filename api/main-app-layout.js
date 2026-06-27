const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const pool = require("./db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const logger = require("./logger");



app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "invalid credentials" });

    const token = crypto.randomBytes(32).toString("hex");
    await pool.query("INSERT INTO tokens (user_id, token) VALUES (?, ?)", [user.id, token]);

     logger.info({
      timestamp: new Date().toISOString(),
      userId: user.id,
      action: "login",
      ip: req.ip,
    });

    res.json({ token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/profile", async (req, res) => {
  try {
    const token = req.headers["x-auth-token"];
    if (!token) return res.status(401).json({ error: "no token" });

    const [rows] = await pool.query("SELECT user_id FROM tokens WHERE token = ?", [token]);
    if (rows.length === 0) return res.status(401).json({ error: "invalid token" });

    res.json({ message: "authenticated", userId: rows[0].user_id });
  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () => console.log("API running on port 3000"));