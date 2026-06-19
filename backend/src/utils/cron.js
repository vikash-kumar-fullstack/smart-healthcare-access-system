import PatientStats from "../modules/queue/patient_stats.model.js";
import BookingCredit from "../modules/queue/booking_credit.model.js";

let lastResetMonth = null;

export const runMonthlyReset = async (testDate = new Date()) => {
  try {
    const now = testDate;
    const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;

    // If this is the first execution, initialize lastResetMonth
    if (!lastResetMonth) {
      lastResetMonth = currentMonth;
      return;
    }

    // If the month has changed since the last check
    if (lastResetMonth !== currentMonth) {
      console.log(`Month changed from ${lastResetMonth} to ${currentMonth}. Resetting monthly no-show counters...`);
      await PatientStats.updateMany({}, { $set: { noShowCountThisMonth: 0 } });
      lastResetMonth = currentMonth;
      console.log("Monthly no-show counts reset successfully.");
    }
  } catch (err) {
    console.error("Failed to run monthly reset job:", err);
  }
};

export const runBookingCreditCleanup = async () => {
  try {
    const res = await BookingCredit.updateMany(
      { expiresAt: { $lt: new Date() }, used: false, expired: false },
      { $set: { expired: true } }
    );
    if (res.modifiedCount > 0) {
      console.log(`Soft-expired ${res.modifiedCount} expired booking credits.`);
    }
  } catch (err) {
    console.error("Failed to run booking credit cleanup:", err);
  }
};

export const initCronJobs = () => {
  // Initialize current month on boot
  const now = new Date();
  lastResetMonth = `${now.getFullYear()}-${now.getMonth()}`;

  console.log(`Initializing monthly no-show reset cron. Current month: ${lastResetMonth}`);

  // Run checker every 1 hour
  setInterval(() => {
    runMonthlyReset();
    runBookingCreditCleanup();
  }, 60 * 60 * 1000);
};
