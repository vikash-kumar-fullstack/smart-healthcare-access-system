import QueueKPI from "../../src/modules/queue/queue_kpi.model.js";

export const seedAnalytics = async (hashedPassword, context) => {
  console.log("Seeding BI Reporting Analytics & Queue KPIs...");

  const hospitals = context.seededHospitals;
  const bulkKPIs = [];

  // Seed data for the last 30 days for each hospital
  const today = new Date();
  
  for (const hosp of hospitals) {
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() - dayOffset);
      const dateStr = date.toISOString().split("T")[0];

      // Dynamic metrics
      const bookings = 40 + (dayOffset % 5) * 15 + Math.floor(Math.random() * 10);
      const checkins = Math.floor(bookings * 0.9);
      const completions = Math.floor(checkins * 0.95);
      const noShows = bookings - checkins;
      const transfers = Math.floor(bookings * 0.05);

      bulkKPIs.push({
        hospitalId: hosp._id,
        date: dateStr,
        totalBookings: bookings,
        totalCheckIns: checkins,
        totalNoShows: noShows,
        totalTransfers: transfers,
        totalCompletions: completions,
        totalWaitTimeMs: completions * 12 * 60 * 1000, // average 12 minutes
        totalSlotsBooked: bookings,
        totalSlotsAvailable: bookings + 20
      });
    }
  }

  // Pre-clean analytics
  await QueueKPI.deleteMany({});

  const created = await QueueKPI.insertMany(bulkKPIs);
  console.log(`  - Seeded ${created.length} days of hospital analytics metrics.`);
  context.seededAnalytics = created;
};
