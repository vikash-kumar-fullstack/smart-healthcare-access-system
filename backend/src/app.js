import express from "express";
// Trigger server reload
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import errorHandler from "./middlewares/error.middleware.js";
import { incrementRequestCount } from "./middlewares/error.middleware.js";
import { generalLimiter } from "./middlewares/rateLimiter.middleware.js";
import { checkEmergencyReadonly } from "./middlewares/readonly.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import queueRoutes from "./modules/queue/queue.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";
import hospitalRoutes from "./modules/hospital/hospital.routes.js";
import doctorRoutes from "./modules/doctor/doctor.routes.js";
import scheduleRoutes from "./modules/doctor/schedule.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import visitRoutes from "./modules/visit/visit.routes.js";
import medicalRecordRoutes from "./modules/medical-records/medical_record.routes.js";
import realtimeRoutes from "./modules/realtime/realtime.routes.js";
import receptionistAdminRoutes from "./modules/admin/receptionist-admin.routes.js";
import receptionRoutes from "./modules/queue/reception.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import familyRoutes from "./modules/user/family.routes.js";

const app = express();

const isProd = process.env.NODE_ENV === "production";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: isProd ? ["'self'", "https://api.medhospi.com"] : ["'self'", "*"]
    }
  },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: "deny" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));

// Compression and caching headers configuration (Module 8)
app.use(compression());

app.use("/static", (req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
});

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  next();
});

// ── Global rate limit (before any routes) ────────────────────────────────────
app.use(generalLimiter);

app.use((req, res, next) => {
  incrementRequestCount();
  next();
});

// ── Body & logging ────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));   // Prevent large payload attacks
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Smart Healthcare API is running." });
});
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development"
  });
});

// ── Readonly Global Middleware ────────────────────────────────────────────────
app.use(checkEmergencyReadonly);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/queue", queueRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/hospitals", hospitalRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/schedule", scheduleRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/visits", visitRoutes);
app.use("/api/v1/medical-records", medicalRecordRoutes);
app.use("/api/v1/realtime", realtimeRoutes);
app.use("/api/v1/hospital/receptionists", receptionistAdminRoutes);
app.use("/api/v1/reception", receptionRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/family", familyRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

export default app;