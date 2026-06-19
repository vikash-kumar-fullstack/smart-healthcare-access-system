import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import errorHandler from "./middlewares/error.middleware.js";
import { generalLimiter } from "./middlewares/rateLimiter.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import queueRoutes from "./modules/queue/queue.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";
import hospitalRoutes from "./modules/hospital/hospital.routes.js";
import doctorRoutes from "./modules/doctor/doctor.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import visitRoutes from "./modules/visit/visit.routes.js";

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));

// ── Global rate limit (before any routes) ────────────────────────────────────
app.use(generalLimiter);

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
    status:    "healthy",
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || "development"
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/auth",          authRoutes);
app.use("/api/v1/queue",         queueRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/hospitals",     hospitalRoutes);
app.use("/api/v1/doctors",       doctorRoutes);
app.use("/api/v1/search",        searchRoutes);
app.use("/api/v1/admin",         adminRoutes);
app.use("/api/v1/visits",        visitRoutes);

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