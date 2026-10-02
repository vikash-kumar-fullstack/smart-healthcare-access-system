import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import Notification from "../src/modules/notification/notification.model.js";
import NotificationSequence from "../src/modules/notification/notification_sequence.model.js";
import User from "../src/modules/auth/auth.model.js";

async function runTests() {
  console.log("==================================================");
  console.log("NOTIFICATION UNREAD FIX — VERIFICATION SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Create isolated test user
  const testUser = await User.create({
    name: "Notif Test Patient",
    email: `notif_test_${Date.now()}@health.local`,
    password: "HashedPassword123!",
    role: "patient",
    profileCompleted: true
  });

  const token = jwt.sign(
    { userId: testUser._id.toString(), role: "patient" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const authHeader = {
    "Authorization": `Bearer ${token}`
  };

  const API_BASE = "http://localhost:5000/api/v1";

  // Helper to create a notification directly in MongoDB
  async function seedNotification(title, status = "delivered", createdAt = new Date()) {
    const seqDoc = await NotificationSequence.findOneAndUpdate(
      { userId: testUser._id },
      { $inc: { current: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    return await Notification.create({
      recipientUserId: testUser._id,
      sequenceNumber: seqDoc.current,
      type: "informational",
      category: "queue",
      title,
      body: `Body for ${title}`,
      channels: ["in_app"],
      status,
      createdAt,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
  }

  try {
    // -------------------------------------------------------------------------
    console.log("--> TEST 1: Initial unread count is 0");
    const resUnread0 = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
    const dataUnread0 = await resUnread0.json();
    assert(dataUnread0.success === true && dataUnread0.data.unreadCount === 0, "Unread count starts at 0");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 2: Seed 1 unread notification and verify unreadCount = 1");
    const notif1 = await seedNotification("Test Alert #1");
    const resUnread1 = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
    const dataUnread1 = await resUnread1.json();
    assert(dataUnread1.success === true && dataUnread1.data.unreadCount === 1, "Unread endpoint reflects 1 unread alert");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 3: PATCH /notifications/read-all with NO request body (was previously 500)");
    const patchNoBody = await fetch(`${API_BASE}/notifications/read-all`, {
      method: "PATCH",
      headers: authHeader
      // Body omitted entirely, no Content-Type
    });
    assert(patchNoBody.status === 200, `PATCH without body returned HTTP 200 (Got: ${patchNoBody.status})`);
    const patchNoBodyData = await patchNoBody.json();
    assert(patchNoBodyData.success === true && patchNoBodyData.data.count === 1, `Marked 1 notification as read`);

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 4: MongoDB status persisted as 'read' and unreadCount is 0");
    const dbNotif1 = await Notification.findById(notif1._id);
    assert(dbNotif1.status === "read" && dbNotif1.readAt instanceof Date, "Notification in MongoDB updated to status: 'read' with valid readAt date");
    const resUnreadAfter = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
    const dataUnreadAfter = await resUnreadAfter.json();
    assert(dataUnreadAfter.data.unreadCount === 0, "Unread endpoint now returns 0");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 5: PATCH /notifications/read-all with empty body {}");
    const notif2 = await seedNotification("Test Alert #2");
    const patchEmptyBody = await fetch(`${API_BASE}/notifications/read-all`, {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert(patchEmptyBody.status === 200, "PATCH with empty body {} returned HTTP 200");
    const dbNotif2 = await Notification.findById(notif2._id);
    assert(dbNotif2.status === "read", "Notification #2 updated to status: 'read'");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 6: Multi-notification verification (3 unread -> read all -> 0 unread)");
    const m1 = await seedNotification("Multi Alert A");
    const m2 = await seedNotification("Multi Alert B");
    const m3 = await seedNotification("Multi Alert C");
    const resMultiBefore = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
    const dataMultiBefore = await resMultiBefore.json();
    assert(dataMultiBefore.data.unreadCount === 3, "Unread count accurately reports 3 unread items");

    const patchMulti = await fetch(`${API_BASE}/notifications/read-all`, {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const dataMultiRes = await patchMulti.json();
    assert(dataMultiRes.success === true && dataMultiRes.data.count === 3, "readAll response confirms count = 3");

    const resMultiAfter = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
    const dataMultiAfter = await resMultiAfter.json();
    assert(dataMultiAfter.data.unreadCount === 0, "Unread count accurately reduced to 0 in MongoDB");

    const unreadInDb = await Notification.countDocuments({
      recipientUserId: testUser._id,
      status: { $nin: ["read", "archived", "expired", "purged"] }
    });
    assert(unreadInDb === 0, "Direct MongoDB count confirms 0 unread documents");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 7: beforeTimestamp filter semantics preserved");
    const pastTime = new Date(Date.now() - 60 * 1000); // 1 min ago
    const olderNotif = await seedNotification("Older Alert", "delivered", pastTime);
    const newerNotif = await seedNotification("Newer Alert", "delivered", new Date());

    const cutoff = new Date(Date.now() - 30 * 1000).toISOString(); // 30s ago
    const patchCutoff = await fetch(`${API_BASE}/notifications/read-all`, {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ beforeTimestamp: cutoff })
    });
    const dataCutoff = await patchCutoff.json();
    assert(dataCutoff.data.count === 1, "Only 1 notification prior to cutoff marked as read");

    const dbOlder = await Notification.findById(olderNotif._id);
    const dbNewer = await Notification.findById(newerNotif._id);
    assert(dbOlder.status === "read", "Older notification prior to cutoff is read");
    assert(dbNewer.status === "delivered", "Newer notification after cutoff remains delivered (unread)");

    // Cleanup remaining
    await fetch(`${API_BASE}/notifications/read-all`, { method: "PATCH", headers: authHeader });

    console.log("\n==================================================");
    console.log(`NOTIFICATION SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    // Cleanup test data
    await Notification.deleteMany({ recipientUserId: testUser._id });
    await NotificationSequence.deleteMany({ userId: testUser._id });
    await User.findByIdAndDelete(testUser._id);
    await mongoose.disconnect();
  }
}

runTests().catch(console.error);
