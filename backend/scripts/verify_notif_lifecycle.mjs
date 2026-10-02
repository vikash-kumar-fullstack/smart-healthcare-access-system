import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import Notification from "../src/modules/notification/notification.model.js";
import NotificationSequence from "../src/modules/notification/notification_sequence.model.js";
import User from "../src/modules/auth/auth.model.js";

async function verifyLifecycle() {
  console.log("==================================================");
  console.log("END-TO-END NOTIFICATION LIFECYCLE VERIFICATION");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  const API_BASE = "http://localhost:5000/api/v1";

  const user = await User.findOne({ email: "patient.browser@health.local" });
  if (!user) throw new Error("Test user not found");

  // Step 1: Login via API to get auth token exactly like browser does
  console.log("Step 1: Authenticate via POST /api/v1/auth/login");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "patient.browser@health.local",
      password: "Password123!"
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;
  if (!token) throw new Error("Login failed: " + JSON.stringify(loginData));
  console.log("  [PASS] Logged in successfully as Sarah Jenkins.");

  const authHeader = {
    "Authorization": `Bearer ${token}`
  };

  // Step 2: Seed 1 unread notification
  console.log("\nStep 2: Seed 1 fresh unread notification in MongoDB");
  await Notification.deleteMany({ recipientUserId: user._id });
  const seq = await NotificationSequence.findOneAndUpdate(
    { userId: user._id },
    { $inc: { current: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const createdNotif = await Notification.create({
    recipientUserId: user._id,
    sequenceNumber: seq.current,
    type: "operational",
    category: "queue",
    title: "Clinic Door Access Code",
    body: "Your entry pass for tomorrow morning has been activated.",
    channels: ["in_app"],
    status: "delivered",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  console.log("  [PASS] Seeded notification ID:", createdNotif._id.toString());

  // Step 3: Check GET /notifications/unread (Navbar, Sidebar, Dashboard query this)
  console.log("\nStep 3: Query GET /notifications/unread (Navbar/Sidebar/Dashboard source of truth)");
  const unreadRes1 = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
  const unreadData1 = await unreadRes1.json();
  console.log("  Unread count returned:", unreadData1.data?.unreadCount);
  if (unreadData1.data?.unreadCount !== 1) throw new Error("Expected unreadCount = 1");
  console.log("  [PASS] unreadCount = 1 verified.");

  // Step 4: Call Notifications.jsx flow -> PATCH /notifications/read-all with {}
  console.log("\nStep 4: Execute Notifications.jsx flow -> PATCH /notifications/read-all with {}");
  const patchRes = await fetch(`${API_BASE}/notifications/read-all`, {
    method: "PATCH",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  console.log("  HTTP Status:", patchRes.status);
  const patchData = await patchRes.json();
  console.log("  Response body:", patchData);
  if (patchRes.status !== 200 || !patchData.success) throw new Error("read-all failed!");
  console.log("  [PASS] PATCH /notifications/read-all succeeded with HTTP 200.");

  // Step 5: Verify MongoDB persistence
  console.log("\nStep 5: Verify MongoDB document persistence");
  const dbNotif = await Notification.findById(createdNotif._id);
  console.log("  Document status in MongoDB:", dbNotif.status);
  console.log("  Document readAt in MongoDB:", dbNotif.readAt);
  if (dbNotif.status !== "read" || !(dbNotif.readAt instanceof Date)) {
    throw new Error("MongoDB status is NOT read!");
  }
  console.log("  [PASS] MongoDB record accurately persisted as status: 'read' with valid readAt.");

  // Step 6: Verify GET /notifications/unread returns 0
  console.log("\nStep 6: Query GET /notifications/unread after read-all");
  const unreadRes2 = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
  const unreadData2 = await unreadRes2.json();
  console.log("  Unread count returned:", unreadData2.data?.unreadCount);
  if (unreadData2.data?.unreadCount !== 0) throw new Error("Expected unreadCount = 0!");
  console.log("  [PASS] unreadCount = 0 verified. Navbar, Sidebar, and Dashboard all show 0.");

  // Step 7: Simulate hard refresh / navigation
  console.log("\nStep 7: Simulate refresh / navigation (Re-query GET /notifications/unread)");
  const unreadResRefresh = await fetch(`${API_BASE}/notifications/unread`, { headers: authHeader });
  const unreadDataRefresh = await unreadResRefresh.json();
  if (unreadDataRefresh.data?.unreadCount !== 0) throw new Error("Failed after refresh!");
  console.log("  [PASS] Persistent 0 unread verified across page refreshes and route transitions.");

  // Step 8: Simulate Logout & Re-login
  console.log("\nStep 8: Simulate Logout and Login (new session)");
  const reLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "patient.browser@health.local",
      password: "Password123!"
    })
  });
  const reLoginData = await reLoginRes.json();
  const newToken = reLoginData.data?.token || reLoginData.token;
  const unreadResReLogin = await fetch(`${API_BASE}/notifications/unread`, {
    headers: { "Authorization": `Bearer ${newToken}` }
  });
  const unreadDataReLogin = await unreadResReLogin.json();
  if (unreadDataReLogin.data?.unreadCount !== 0) throw new Error("Failed after re-login!");
  console.log("  [PASS] Persistent 0 unread verified after fresh re-login.");

  // Step 9: Seed new notification and verify count increments again
  console.log("\nStep 9: Seed genuinely new notification");
  const seq2 = await NotificationSequence.findOneAndUpdate(
    { userId: user._id },
    { $inc: { current: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  await Notification.create({
    recipientUserId: user._id,
    sequenceNumber: seq2.current,
    type: "operational",
    category: "queue",
    title: "Queue Position Update",
    body: "Only 2 patients ahead of you.",
    channels: ["in_app"],
    status: "delivered",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  const unreadResNew = await fetch(`${API_BASE}/notifications/unread`, {
    headers: { "Authorization": `Bearer ${newToken}` }
  });
  const unreadDataNew = await unreadResNew.json();
  console.log("  Unread count returned for new notification:", unreadDataNew.data?.unreadCount);
  if (unreadDataNew.data?.unreadCount !== 1) throw new Error("Expected unreadCount = 1 after new notification!");
  console.log("  [PASS] New notification increments unreadCount to 1 across all consumers.");

  // Step 10: Clear new notification with no-body PATCH request
  console.log("\nStep 10: Call PATCH /notifications/read-all with NO body");
  const clearRes = await fetch(`${API_BASE}/notifications/read-all`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${newToken}` }
  });
  if (clearRes.status !== 200) throw new Error("No-body PATCH failed!");
  const unreadResFinal = await fetch(`${API_BASE}/notifications/unread`, {
    headers: { "Authorization": `Bearer ${newToken}` }
  });
  const unreadDataFinal = await unreadResFinal.json();
  if (unreadDataFinal.data?.unreadCount !== 0) throw new Error("Expected 0 after clear!");
  console.log("  [PASS] Successfully cleared back to 0.");

  console.log("\n==================================================");
  console.log("ALL 10 LIFECYCLE STEPS PASSED PERFECTLY!");
  console.log("==================================================");

  await mongoose.disconnect();
}

verifyLifecycle().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
