import app from "./app.js";
import http from "http";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { initCronJobs } from "./utils/cron.js";
import { initSocket } from "./utils/socket.js";
import { initNotificationWorkers } from "./modules/notification/notification_worker.js";
import { initSearchWorkers } from "./modules/search/search_worker.js";
import { initHealthWorker } from "./modules/admin/system_health_worker.js";
import { initReportWorker } from "./modules/admin/admin_report_worker.js";
import { initRealtimeWorkers } from "./modules/realtime/realtime_worker.js";
import { startReminderWorker } from "./modules/queue/reminder_worker.js";
import { validateEnvironment } from "./config/environment.validator.js";
import { initializeWorkers } from "./workers/index.js";

dotenv.config();
validateEnvironment();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Connect DB
connectDB().then(() => {
  // Initialize cron schedules
  initCronJobs();
  // Initialize isolated background cron jobs
  initializeWorkers();
  // Initialize background notification processing workers
  initNotificationWorkers(500);
  // Initialize background search analytics processing workers
  initSearchWorkers(500);
  // Initialize health telemetry worker
  initHealthWorker(60000);
  // Initialize async report builder worker
  initReportWorker(5000);
  // Initialize realtime retry and cleanup workers
  initRealtimeWorkers(2000);
  // Initialize appointment reminder & no-show worker
  startReminderWorker(10000);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});