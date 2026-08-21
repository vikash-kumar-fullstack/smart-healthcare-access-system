import fs from "fs";
import path from "path";

const targetDirs = [
  "src/modules/auth",
  "src/modules/queue",
  "src/modules/visit",
  "src/modules/notification",
  "src/modules/medical-records"
];

let failed = false;

const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  
  // Find lines with Mongoose find calls
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    // Check if the line has .find( or .findOne( or .findById(
    if (line.includes(".find(") || line.includes(".findOne(") || line.includes(".findById(")) {
      // Skip if it is a lean query or a write/count query
      const isLean = line.includes(".lean(") || line.includes(".lean()");
      const isSelect = line.includes(".select(") || line.includes(".select()");
      const isCount = line.includes("countDocuments") || line.includes("estimatedDocumentCount");
      const isSkip = line.includes("deleteMany") || line.includes("updateMany") || line.includes("findByIdAndUpdate") || line.includes("findOneAndUpdate");

      // We only care about high volume find queries in controllers/services
      if (!isLean && !isSelect && !isCount && !isSkip) {
        // Double check context
        if (filePath.includes("controller") || filePath.includes("service")) {
          console.warn(`[WARN] Potential unoptimized query at ${path.basename(filePath)}:${idx + 1}: "${line.trim()}"`);
        }
      }
    }
  });
};

const scanDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      scanFile(fullPath);
    }
  }
};

console.log("Analyzing controllers and services for lean/select query optimization...");
targetDirs.forEach(dir => scanDir(dir));

console.log("🎉 QUERY AUDIT COMPLETED SUCCESSFULLY!");
process.exit(failed ? 1 : 0);
