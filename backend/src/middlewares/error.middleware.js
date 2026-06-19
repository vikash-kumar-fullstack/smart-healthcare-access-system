/**
 * Global error handler middleware.
 * - In development: returns full stack trace for easy debugging.
 * - In production: returns clean message only, never leaks internals.
 */
const errorHandler = (err, req, res, next) => {
  const isDev    = process.env.NODE_ENV !== "production";
  const status   = err.status || err.statusCode || 500;
  const message  = err.message || "An unexpected error occurred.";

  // Log every 5xx error server-side regardless of env
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${status}:`, err);
  }

  return res.status(status).json({
    success: false,
    message,
    ...(err.data && { data: err.data }),
    ...(isDev && status >= 500 && { stack: err.stack }) // only in dev
  });
};

export default errorHandler;
