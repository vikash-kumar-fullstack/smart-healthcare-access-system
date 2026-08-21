import mongoose from "mongoose";
import Notification from "../../src/modules/notification/notification.model.js";

export const seedNotifications = async (hashedPassword, context) => {
  console.log("Seeding Categorized Priority Notifications Center...");

  const showcasePatient = context.seededPatients.find(p => p.email === "patient@medhospi.com");
  const showcaseDoc = context.seededDoctors.find(d => d.name.includes("Alok Sen"));

  const notifications = [];

  if (showcasePatient) {
    notifications.push(
      {
        recipientUserId: showcasePatient._id,
        sequenceNumber: 1,
        type: "operational",
        category: "queue",
        title: "🔴 CRITICAL: Consultation starting in 10 minutes",
        body: "Your token MH-TODAY-001 with Dr. Alok Sen is close. Please sit near clinical Room 3.",
        status: "delivered",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        recipientUserId: showcasePatient._id,
        sequenceNumber: 2,
        type: "transactional",
        category: "report",
        title: "🟠 IMPORTANT: CBC Diagnostic Summary uploaded",
        body: "Dr. Alok Sen signed your diagnostic report cbc.pdf. Available in Medical Passport.",
        status: "delivered",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        recipientUserId: showcasePatient._id,
        sequenceNumber: 3,
        type: "informational",
        category: "booking",
        title: "🟢 INFO: Booking Confirmation Slot Reserved",
        body: "Appointment confirmed with AIIMS Delhi today at 10:30 AM.",
        status: "read",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    );
  }

  if (showcaseDoc) {
    notifications.push(
      {
        recipientUserId: showcaseDoc.userId,
        sequenceNumber: 1,
        type: "operational",
        category: "queue",
        title: "🔴 CRITICAL: Patient Checked In and Waiting",
        body: "Patient Vikash Kumar has triggered GPS self check-in and is ready at pos 1.",
        status: "delivered",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    );
  }

  // Pre-clean notifications
  await Notification.deleteMany({});

  // Use native bulk insert to bypass status transition middlewares
  await mongoose.connection.db.collection("notifications").insertMany(notifications);
  const created = await Notification.find({});

  console.log(`  - Seeded ${created.length} active notifications.`);
  context.seededNotifications = created;
};
