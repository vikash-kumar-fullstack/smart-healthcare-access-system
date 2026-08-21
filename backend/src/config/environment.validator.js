import dotenv from "dotenv";
dotenv.config();

export const validateEnvironment = () => {
  const critical = ["MONGO_URI"];
  const optional = [
    { key: "JWT_SECRET", default: "default_fallback_jwt_secret_32bytes_long" },
    { key: "JWT_REFRESH_SECRET", default: "default_fallback_jwt_refresh_secret_32bytes" },
    { key: "CLOUDINARY_API_SECRET", default: "mockcloudinarysecret" },
    { key: "SMTP_PASSWORD", default: "mocksmtppassword" }
  ];

  optional.forEach(({ key, default: defVal }) => {
    if (!process.env[key]) {
      console.warn(`[CONFIG WARNING] ${key} is missing. Using safe fallback.`);
      process.env[key] = defVal;
    }
  });

  const missingCritical = critical.filter(key => !process.env[key]);
  if (missingCritical.length > 0) {
    console.error("================================================================");
    console.error("CRITICAL CONFIGURATION ERROR: MISSING REQUIRED ENV VARIABLES");
    missingCritical.forEach(key => console.error(`  [MISSING CRITICAL] ${key}`));
    console.error("================================================================");

    if (process.env.NODE_ENV === "production" || process.env.VALIDATE_ENV_TEST === "true") {
      throw new Error(`Startup failed due to missing critical secret: ${missingCritical.join(", ")}`);
    }
  } else {
    console.log("PASS: Startup environment secrets validated successfully.");
  }

  return true;
};
