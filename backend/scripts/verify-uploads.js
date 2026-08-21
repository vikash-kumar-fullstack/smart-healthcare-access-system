import { validateUpload } from "../src/utils/upload-security.service.js";

const verifyUploads = () => {
  try {
    const validFile = {
      originalname: "prescription.pdf",
      size: 5 * 1024 * 1024,
      mimetype: "application/pdf"
    };

    const oversizedFile = {
      originalname: "scan.png",
      size: 12 * 1024 * 1024,
      mimetype: "image/png"
    };

    const maliciousFile = {
      originalname: "exploit.exe",
      size: 1 * 1024 * 1024,
      mimetype: "application/x-msdownload"
    };

    const zipFile = {
      originalname: "data.zip",
      size: 2 * 1024 * 1024,
      mimetype: "application/zip"
    };

    // Assert valid upload passes
    if (!validateUpload(validFile)) {
      console.error("FAIL: Valid PDF file was rejected!");
      process.exit(1);
    }
    console.log("PASS: Valid file successfully accepted.");

    // Assert oversized is blocked
    try {
      validateUpload(oversizedFile);
      console.error("FAIL: 12MB file was allowed!");
      process.exit(1);
    } catch (err) {
      console.log("PASS: Oversized file successfully blocked:", err.message);
    }

    // Assert executable is blocked
    try {
      validateUpload(maliciousFile);
      console.error("FAIL: Executable (.exe) was allowed!");
      process.exit(1);
    } catch (err) {
      console.log("PASS: Prohibited executable successfully blocked:", err.message);
    }

    // Assert zip is blocked
    try {
      validateUpload(zipFile);
      console.error("FAIL: Archive (.zip) was allowed!");
      process.exit(1);
    } catch (err) {
      console.log("PASS: Archive successfully blocked:", err.message);
    }

    console.log("FILE UPLOAD SECURITY VERIFICATION PASSED.");
    process.exit(0);
  } catch (err) {
    console.error("Uploads verification failure:", err);
    process.exit(1);
  }
};

verifyUploads();
