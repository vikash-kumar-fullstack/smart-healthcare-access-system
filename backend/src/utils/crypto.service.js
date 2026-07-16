import crypto from "crypto";

const getEncryptionKey = () => {
  const rawKey = process.env.FIELD_ENCRYPTION_KEY || "medhospi_encryption_key_secret_2026";
  return crypto.createHash("sha256").update(rawKey).digest(); // returns derived 32-byte buffer
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export const encrypt = (text) => {
  if (!text) return text;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag().toString("hex");
    
    // Format iv:tag:ciphertext
    return `${iv.toString("hex")}:${tag}:${encrypted}`;
  } catch (err) {
    console.error("Crypto encryption failed:", err);
    return text;
  }
};

export const decrypt = (cipherText) => {
  if (!cipherText || typeof cipherText !== "string") return cipherText;
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) {
      // Not encrypted
      return cipherText;
    }
    
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err) {
    // Return original cipherText as fallback to avoid crashing existing records
    return cipherText;
  }
};

export const hash = (text) => {
  if (!text) return text;
  return crypto.createHash("sha256").update(text).digest("hex");
};
