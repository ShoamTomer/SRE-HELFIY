const login = await fetch("http://localhost:3000/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "password123" }),
});
const { token } = await login.json();
console.log("TOKEN:", token);

const good = await fetch("http://localhost:3000/profile", {
  headers: { "x-auth-token": token },
});
console.log("WITH VALID TOKEN:", await good.json());

const bad = await fetch("http://localhost:3000/profile", {
  headers: { "x-auth-token": "garbage123" },
});
console.log("WITH BAD TOKEN:", await bad.json());