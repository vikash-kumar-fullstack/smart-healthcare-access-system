export const validateUpload = (file) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  // 10MB limit
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("File exceeds maximum allowed size of 10MB");
  }

  const allowedExts = ["pdf", "png", "jpg", "jpeg", "webp"];
  const blockedExts = ["exe", "bat", "js", "zip", "rar"];

  const filename = file.name || file.originalname || "";
  const ext = filename.split(".").pop().toLowerCase();

  if (blockedExts.includes(ext)) {
    throw new Error(`File upload blocked: Executables and archives (.${ext}) are prohibited.`);
  }

  if (!allowedExts.includes(ext)) {
    throw new Error(`File type .${ext} is not allowed. Allowed types: PDF, PNG, JPG, JPEG, WEBP.`);
  }

  // Validate standard mime types
  const allowedMimeTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];

  const mime = file.mimetype || file.type || "";
  if (mime && !allowedMimeTypes.includes(mime)) {
    throw new Error(`Invalid file type format: ${mime} is not supported.`);
  }

  return true;
};
