import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { printDemoAccounts } from "./demo.accounts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runSeeder = () => {
  console.log("🌱 Seeding MedHospi Master Demo Datasets...");
  const masterSeedPath = path.join(__dirname, "..", "seed", "master.seed.js");
  
  const child = spawn("node", [masterSeedPath], { stdio: "inherit" });
  
  child.on("close", (code) => {
    if (code === 0) {
      console.log("\n✅ Demo Datasets Populated successfully.");
      printDemoAccounts();
      process.exit(0);
    } else {
      console.error(`❌ Seeder process exited with code ${code}`);
      process.exit(1);
    }
  });
};

runSeeder();
