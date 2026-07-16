import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ─── General API rate limiter ─────────────────────────────────────────────────
// 100 requests per 15 minutes per IP — protects all routes from abuse
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and try again in a few minutes."
  },
  skip: () => process.env.NODE_ENV !== "production"
});

// ─── Booking rate limiter ─────────────────────────────────────────────────────
// Prevents a patient from hammering the booking endpoint.
// Real scenario: someone refreshing and double-clicking "Book" repeatedly.
// Limit: 5 booking attempts per 10 minutes per IP.
export const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip), // per-user when authenticated
  message: {
    success: false,
    message: "Too many booking attempts. Please wait a few minutes before trying again."
  },
  skip: (req) => {
    if (process.env.NODE_ENV !== "production") return true;
    // Don't rate-limit if not authenticated (auth middleware will reject anyway)
    return !req.user;
  }
});

// ─── Auth rate limiter ────────────────────────────────────────────────────────
// Brute-force protection on login/register endpoints.
// Limit: 10 attempts per 15 minutes per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes."
  },
  skip: () => process.env.NODE_ENV !== "production"
});
