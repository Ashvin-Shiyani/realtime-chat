const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Database("chat.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    text TEXT,
    time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.static(path.join(__dirname, "public")));

const users = {};

io.on("connection", (socket) => {
socket.on("join", (username) => {
    const taken = Object.values(users).includes(username);
    if (taken) {
      socket.emit("joinError", "Username already taken!");
      return;
    }
    users[socket.id] = username;
    socket.emit('joinSuccess');

    const history = db.prepare(`
      SELECT username, text, time 
      FROM messages 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all().reverse();

    socket.emit("history", history);

    io.emit("system", { message: `${username} joined the chat`, type: "join" });
    io.emit("userList", Object.values(users));
  });

  socket.on("message", (data) => {
    const username = users[socket.id] || "Anonymous";
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    db.prepare(`
      INSERT INTO messages (username, text, time) VALUES (?, ?, ?)
    `).run(username, data.text, time);

    io.emit("message", {
      id: Date.now(),
      username,
      text: data.text,
      time,
      socketId: socket.id,
    });
  });

  socket.on("typing", (isTyping) => {
    const username = users[socket.id];
    socket.broadcast.emit("typing", { username, isTyping });
  });

  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      delete users[socket.id];
      io.emit("system", { message: `${username} left the chat`, type: "leave" });
      io.emit("userList", Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat server running at http://localhost:${PORT}`);
});