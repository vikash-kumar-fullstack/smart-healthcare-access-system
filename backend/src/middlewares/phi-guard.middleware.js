import phiClassification from "../config/phi-classification.js";

// Helper to deeply redact any PHI or SENSITIVE fields
export const redactPHI = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactPHI(item));
  }

  // Check if it's a mongoose document and convert to object
  const cleanObj = typeof obj.toObject === "function" ? obj.toObject() : obj;

  const redacted = {};
  for (const [key, value] of Object.entries(cleanObj)) {
    if (phiClassification.PHI.includes(key)) {
      redacted[key] = "[REDACTED_PHI]";
    } else if (phiClassification.SENSITIVE.includes(key)) {
      redacted[key] = "[REDACTED_SENSITIVE]";
    } else {
      redacted[key] = redactPHI(value);
    }
  }
  return redacted;
};

// Express middleware to prevent accidental export or analytics ingestion of PHI data
export const phiGuardMiddleware = (req, res, next) => {
  const isAnalyticsOrExport = req.path.includes("analytics") || req.path.includes("export");
  if (isAnalyticsOrExport && req.body) {
    req.body = redactPHI(req.body);
  }

  const originalJson = res.json;
  res.json = function (body) {
    if (isAnalyticsOrExport && body && body.data) {
      body.data = redactPHI(body.data);
    }
    return originalJson.call(this, body);
  };

  next();
};
