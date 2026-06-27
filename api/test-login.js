const res = await fetch("http://localhost:3000/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "password123" }),
});
const data = await res.json();
console.log("RESPONSE:", data);