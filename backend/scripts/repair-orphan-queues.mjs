import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const isDryRun = process.argv.includes("--dry-run");

async function runRepair() {
  console.log(`==================================================`);
  console.log(`ORPHAN QUEUE REPAIR TOOL ${isDryRun ? "[DRY RUN]" : "[LIVE REPAIR]"}`);
  console.log(`==================================================\n`);

  if (!process.env.MONGO_URI) {
    console.error("ERROR: MONGO_URI environment variable not found.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB database successfully.\n");

  const queueCollection = mongoose.connection.collection("queues");
  const bookingCollection = mongoose.connection.collection("appointmentbookings");

  const activeQueues = await queueCollection.find({ isActive: true }).toArray();
  console.log(`Found ${activeQueues.length} active Queue record(s) to inspect.\n`);

  let scanned = 0;
  let repaired = 0;
  let skipped = 0;
  let errors = 0;

  for (const queue of activeQueues) {
    scanned++;
    try {
      // Find matching AppointmentBooking
      const booking = await bookingCollection.findOne({
        userId: queue.userId,
        sessionId: queue.sessionId
      });

      const terminalStatuses = ["CANCELLED", "COMPLETED", "EXPIRED", "TRANSFERRED"];
      const isTerminal = !booking || terminalStatuses.includes(booking.status) || booking.arrivalStatus === "NO_SHOW";

      if (isTerminal) {
        const bookingIdStr = booking ? booking._id.toString() : "MISSING";
        const bookingStatusStr = booking ? booking.status : "NONE";
        const arrivalStatusStr = booking ? (booking.arrivalStatus || "N/A") : "N/A";

        console.log(`[ORPHAN DETECTED]`);
        console.log(`  Queue ID:             ${queue._id}`);
        console.log(`  Booking ID:           ${bookingIdStr}`);
        console.log(`  Old Queue Status:     ${queue.status}`);
        console.log(`  Old isActive:         ${queue.isActive}`);
        console.log(`  Booking Status:       ${bookingStatusStr}`);
        console.log(`  Arrival Status:       ${arrivalStatusStr}`);

        const newStatus = (booking?.arrivalStatus === "NO_SHOW")
          ? "no_show"
          : (booking?.status === "COMPLETED")
            ? "completed"
            : "cancelled";

        const updateFields = {
          isActive: false,
          status: newStatus,
          updatedAt: new Date()
        };

        if (newStatus === "no_show") {
          updateFields.closedReason = "no_show";
        } else if (newStatus === "completed") {
          updateFields.closedReason = "completed";
        } else {
          updateFields.cancelReason = "orphan_cleanup";
        }

        if (!isDryRun) {
          await queueCollection.updateOne(
            { _id: queue._id },
            { $set: updateFields }
          );
          console.log(`  -> Action: REPAIRED (isActive: false, status: "${newStatus}")\n`);
        } else {
          console.log(`  -> Action: WOULD REPAIR (isActive: false, status: "${newStatus}") [DRY RUN]\n`);
        }
        repaired++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`Error processing Queue ID ${queue._id}:`, err.message);
      errors++;
    }
  }

  console.log(`==================================================`);
  console.log(`REPAIR SUMMARY:`);
  console.log(`  Scanned:  ${scanned}`);
  console.log(`  Repaired: ${repaired}`);
  console.log(`  Skipped:  ${skipped} (genuinely active)`);
  console.log(`  Errors:   ${errors}`);
  console.log(`==================================================\n`);

  await mongoose.disconnect();
}

runRepair().catch((err) => {
  console.error("Fatal repair error:", err);
  process.exit(1);
});
