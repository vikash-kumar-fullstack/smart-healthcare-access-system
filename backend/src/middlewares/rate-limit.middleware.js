import rateLimit from "express-rate-limit";

// Skip rate limiting in testing environment to facilitate smooth integration runs
const skipInTesting = () => process.env.NODE_ENV === "test" || process.env.DEMO_MODE === "true";

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please slow down and try again in a minute."
  },
  skip: skipInTesting
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Registration limit exceeded. You can register up to 3 accounts per hour."
  },
  skip: skipInTesting
});

export const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many booking requests. Please wait a moment before trying again."
  },
  skip: skipInTesting
});

export const familyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many family requests. Please slow down."
  },
  skip: skipInTesting
});
