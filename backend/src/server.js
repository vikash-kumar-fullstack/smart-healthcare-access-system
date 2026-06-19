import app from "./app.js";
import http from "http";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { initCronJobs } from "./utils/cron.js";
import { initSocket } from "./utils/socket.js";
import { initNotificationWorkers } from "./modules/notification/notification_worker.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Connect DB
connectDB().then(() => {
  // Initialize cron schedules
  initCronJobs();
  // Initialize background notification processing workers
  initNotificationWorkers(500);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});