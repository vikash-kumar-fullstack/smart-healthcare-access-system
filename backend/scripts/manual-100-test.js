import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { io } from "socket.io-client";
import jwt from "jsonwebtoken";

dotenv.config();

import app from "../src/app.js";
import User from "../src/modules/auth/auth.model.js";
import Notification from "../src/modules/notification/notification.model.js";
import NotificationOutbox from "../src/modules/notification/notification_outbox.model.js";
import NotificationCounter from "../src/modules/notification/notification_counter.model.js";
import NotificationSequence from "../src/modules/notification/notification_sequence.model.js";
import { createNotification } from "../src/modules/notification/notification.service.js";
import { initNotificationWorkers, stopNotificationWorkers } from "../src/modules/notification/notification_worker.js";
import { initSocket } from "../src/utils/socket.js";

const rewriteMongoUri = (uri) => {
  if (!uri) return uri;
  const parts = uri.split("?");
  let hostPart = parts[0];
  const queryPart = parts[1] ? `?${parts[1]}` : "";
  if (hostPart.endsWith("/")) {
    hostPart = hostPart.slice(0, -1);
  }
  const protocolEndIdx = hostPart.indexOf("://");
  const pathStartIdx = hostPart.indexOf("/", protocolEndIdx + 3);
  if (pathStartIdx !== -1) {
    hostPart = hostPart.substring(0, pathStartIdx);
  }
  return `${hostPart}/smart-healthcare-test${queryPart}`;
};

const run = async () => {
  const testMongoUri = rewriteMongoUri(process.env.MONGO_URI);
  console.log("Connecting to isolated test database...");
  await mongoose.connect(testMongoUri);
  console.log("Connected to MongoDB.");

  // Clean up any leftovers from previous manual runs to prevent worker interference
  await Notification.deleteMany({ title: /Notification #/ });
  await NotificationOutbox.deleteMany({ "payload.title": /Notification #/ });

  const testUserId = new mongoose.Types.ObjectId();
  await Notification.deleteMany({ recipientUserId: testUserId });
  await NotificationOutbox.deleteMany({ "payload.recipientUserId": testUserId });
  await NotificationCounter.deleteMany({ userId: testUserId });
  await NotificationSequence.deleteMany({ userId: testUserId });

  console.log("Cleaned up database for test user:", testUserId);

  // 1. Simulate server offline (enqueuing notifications while dispatcher is not running)
  console.log("\n--- STEP 1: Enqueue 100 notifications while server is offline ---");
  for (let i = 1; i <= 100; i++) {
    const res = await createNotification(testUserId, `Notification #${i}`, `Body of notification #${i}`, "booking", {
      category: "queue",
      type: "transactional",
      eventType: `event_${i}`
    });
    assert.ok(res, `Enqueued outbox #${i}`);
  }

  // Verify total enqueued is 100
  const totalCount = await NotificationOutbox.countDocuments({ "payload.recipientUserId": testUserId });
  assert.equal(totalCount, 100, "Should have exactly 100 enqueued outbox notifications");
  console.log("Verified: 100 notifications enqueued in Outbox.");

  // 2. Simulate Server Start
  console.log("\n--- STEP 2: Starting HTTP & Socket Server (Online) ---");
  const server = http.createServer(app);
  initSocket(server);
  server.listen(0); // Listen on random free port to prevent conflicts
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const socketUrl = `http://127.0.0.1:${port}`;
  console.log("Server listening on isolated port:", port);

  // Connect socket client
  const token = jwt.sign({ userId: testUserId.toString(), role: "patient" }, process.env.JWT_SECRET);
  const socket = io(socketUrl, {
    query: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500
  });

  let receivedCount = 0;
  const receivedSequenceList = [];
  const connectionPromise = new Promise((resolve) => {
    socket.on("connect", () => {
      console.log("Mock client socket connected successfully to port:", port);
      resolve();
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("Mock client socket disconnected. Reason:", reason);
  });

  socket.on("reconnect", (attempt) => {
    console.log("Mock client socket reconnected on attempt #", attempt);
  });

  socket.on("notification", (data) => {
    receivedCount++;
    
    // Parse order number from the title (e.g., "Notification #42")
    const match = data.title.match(/#(\d+)/);
    if (match) {
      receivedSequenceList.push(parseInt(match[1], 10));
    }

    if (data.id) {
      // Introduce a random ACK delay between 5ms and 50ms to simulate network jitter
      // and test concurrency race condition handling (VersionError ignore)
      const ackDelay = Math.floor(Math.random() * 45) + 5;
      setTimeout(() => {
        socket.emit("notification_delivered_ack", { notificationId: data.id });
      }, ackDelay);
    }
  });

  console.log("Mock client socket listening for events with random ACK delays...");

  console.log("Waiting for client socket to be fully connected...");
  await connectionPromise;

  // Start workers locally
  console.log("Starting background workers...");
  initNotificationWorkers(50);

  // Wait for all 100 to process
  console.log("Waiting for workers to process and client to ACK...");
  const start = Date.now();
  let completed = false;
  while (Date.now() - start < 90000) {
    const processedCount = await NotificationOutbox.countDocuments({ "payload.recipientUserId": testUserId, status: "processed" });
    const deliveredCount = await Notification.countDocuments({ recipientUserId: testUserId, status: "delivered" });
    const archivedCount = await Notification.countDocuments({ recipientUserId: testUserId, status: "archived" });
    
    if (processedCount === 100 && (deliveredCount + archivedCount) === 100 && receivedCount === 100) {
      await new Promise(r => setTimeout(r, 1000));
      completed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  assert.ok(completed, `Timed out. processedCount: ${await NotificationOutbox.countDocuments({ "payload.recipientUserId": testUserId, status: "processed" })}, received: ${receivedCount}`);

  // 3. Verify results
  console.log("\n--- STEP 3: Verification ---");

  // A. Verify no duplicates in sequence number (1 to 100)
  const notifs = await Notification.find({ recipientUserId: testUserId }).sort({ sequenceNumber: 1 });
  assert.equal(notifs.length, 100, "Should have exactly 100 notifications in database");

  const seqs = notifs.map(n => n.sequenceNumber);
  const uniqueSeqs = new Set(seqs);
  assert.equal(uniqueSeqs.size, 100, "All sequence numbers must be unique");
  for (let i = 1; i <= 100; i++) {
    assert.equal(seqs[i-1], i, `Sequence number should be exactly ${i}`);
  }
  console.log("✓ Verification Passed: No duplicate sequence numbers. Sequencing order 1 to 100 is exact.");

  // B. Verify status: since they are Doctor Queue replace rule notifications, 99 are archived and the last 1 is delivered.
  const deliveredNotifs = notifs.filter(n => n.status === "delivered");
  const archivedNotifs = notifs.filter(n => n.status === "archived");
  assert.equal(deliveredNotifs.length, 1, "Exactly the last notification should be delivered");
  assert.equal(archivedNotifs.length, 99, "99 previous notifications should be archived");
  console.log("✓ Verification Passed: All 100 notifications successfully dispatched and ACKed.");

  // C. Verify unread count is exact: since only 1 is delivered, the unreadCount must be exactly 1!
  const counter = await NotificationCounter.findOne({ userId: testUserId });
  assert.ok(counter, "Counter doc should exist");
  assert.equal(counter.unreadCount, 1, "Unread count should be exactly 1");
  console.log("✓ Verification Passed: Unread counter cache is exactly correct (value: 1).");

  // D. Verify receipt order matches sequence order (Disorder Check)
  assert.equal(receivedSequenceList.length, 100, "Should have received 100 notifications on socket");
  const expectedOrder = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.deepEqual(receivedSequenceList, expectedOrder, "Delivery receipt order must match sequence creation order");
  console.log("✓ Verification Passed: WebSocket delivery receipt order matches sequence creation order 1..100.");

  // E. Observe race count metrics
  const SystemMonitoring = mongoose.model("SystemMonitoring");
  const monitoring = await SystemMonitoring.findOne({ name: "global" });
  const raceCount = monitoring ? (monitoring.notification_ack_race_count || 0) : 0;
  console.log(`✓ Verification: notification_ack_race_count in SystemMonitoring is ${raceCount} (race conditions caught/ignored).`);

  // Clean up
  socket.disconnect();
  stopNotificationWorkers();
  await new Promise(r => server.close(r));
  await mongoose.disconnect();
  console.log("\nManual verification scenario completed successfully!");
  process.exit(0);
};

run().catch(err => {
  console.error("Manual verification failed:", err);
  process.exit(1);
});
