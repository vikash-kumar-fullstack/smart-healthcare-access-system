import dotenv from "dotenv";
dotenv.config();

export const validateEnvironment = () => {
  const required = [
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "MONGO_URI",
    "CLOUDINARY_API_SECRET",
    "SMTP_PASSWORD"
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn("================================================================");
    console.warn("CRITICAL CONFIGURATION WARNING: MISSING REQUIRED ENV VARIABLES");
    missing.forEach(key => console.warn(`  [MISSING] ${key}`));
    console.warn("================================================================");
    
    // Only refuse startup in production mode or during verify script runs
    if (process.env.NODE_ENV === "production" || process.env.VALIDATE_ENV_TEST === "true") {
      throw new Error(`Startup failed due to missing secrets: ${missing.join(", ")}`);
    }
  } else {
    console.log("PASS: Startup secrets validated successfully.");
  }
  
  return true;
};
