const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
 
const app = express();
const server = http.createServer(app);
const io = new Server(server);
 
// Serve the frontend
app.use(express.static(path.join(__dirname, "public")));
 
// Store connected users
const users = {};
 
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
 
  // User joins with a username
  socket.on("join", (username) => {
    users[socket.id] = username;
    console.log(`${username} joined the chat`);
 
    // Notify everyone that a new user joined
    io.emit("system", { message: `${username} joined the chat 👋`, type: "join" });
 
    // Send updated user list to everyone
    io.emit("userList", Object.values(users));
  });
 
  // Handle incoming chat messages
  socket.on("message", (data) => {
    const username = users[socket.id] || "Anonymous";
    console.log(`[${username}]: ${data.text}`);
 
    // Broadcast the message to everyone
    io.emit("message", {
      id: Date.now(),
      username,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      socketId: socket.id,
    });
  });
 
  // Handle typing indicator
  socket.on("typing", (isTyping) => {
    const username = users[socket.id];
    socket.broadcast.emit("typing", { username, isTyping });
  });
 
  // Handle disconnect
  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      console.log(`${username} left the chat`);
      delete users[socket.id];
      io.emit("system", { message: `${username} left the chat`, type: "leave" });
      io.emit("userList", Object.values(users));
    }
  });
});
 
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n Chat server running at http://localhost:${PORT}\n`);
});