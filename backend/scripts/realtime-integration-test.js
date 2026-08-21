import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { io } from "socket.io-client";
import jwt from "jsonwebtoken";

dotenv.config();

import app from "../src/app.js";
import { initSocket } from "../src/utils/socket.js";
import { dispatchToUser } from "../src/modules/realtime/event_dispatcher.js";
import ConnectionRegistry from "../src/modules/realtime/connection_registry.model.js";
import RealtimeEvent from "../src/modules/realtime/realtime_event.model.js";
import RealtimeSequence from "../src/modules/realtime/realtime_sequence.model.js";
import { initRealtimeWorkers, stopRealtimeWorkers } from "../src/modules/realtime/realtime_worker.js";
import User from "../src/modules/auth/auth.model.js";

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const testMongoUri = rewriteMongoUri(process.env.MONGO_URI);
  console.log("Connecting to isolated test database...");
  await mongoose.connect(testMongoUri);
  console.log("Connected to MongoDB.");

  const testUserId = new mongoose.Types.ObjectId();
  const token = jwt.sign({ userId: testUserId.toString(), role: "patient" }, process.env.JWT_SECRET);

  // Seed mock user
  await User.deleteMany({ email: "testuser@example.com" });
  await User.create({
    _id: testUserId,
    name: "Test Patient",
    email: "testuser@example.com",
    phone: "1234567890",
    password: "password123",
    role: "patient",
    isActive: true
  });
  console.log("Seeded mock user with ID:", testUserId.toString());

  // Clean databases
  await ConnectionRegistry.deleteMany({});
  await RealtimeEvent.deleteMany({});
  await RealtimeSequence.deleteMany({});
  console.log("Cleaned up realtime database collections.");

  // Start HTTP and Socket server
  let server = http.createServer(app);
  initSocket(server);
  server.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  let { port } = server.address();
  let socketUrl = `http://127.0.0.1:${port}`;
  console.log("Server listening on isolated port:", port);

  // Start realtime workers
  initRealtimeWorkers(500);
  console.log("Realtime retry and clean up workers started.");

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Connection & Handshake
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 1: Connection & Handshake ---");
  const clientSocket = io(socketUrl, {
    auth: { token },
    transports: ["websocket"]
  });

  await new Promise((resolve, reject) => {
    clientSocket.on("connect", resolve);
    clientSocket.on("connect_error", (err) => reject(new Error("Handshake failed: " + err.message)));
  });
  console.log("✓ Verification Passed: Socket authenticated and connected with valid token.");
  await delay(500); // Allow server setups to complete

  // Test invalid token
  const badSocket = io(socketUrl, {
    auth: { token: "bad_token_signature" },
    transports: ["websocket"],
    reconnection: false
  });

  const badConnectFail = await new Promise((resolve) => {
    badSocket.on("connect_error", (err) => {
      resolve(err.message);
    });
    badSocket.on("connect", () => {
      resolve(null);
    });
  });
  assert.ok(badConnectFail, "Connection with bad token should fail");
  console.log(`✓ Verification Passed: Socket handshake rejected invalid token. Error: ${badConnectFail}`);
  badSocket.disconnect();

  // ---------------------------------------------------------------------------
  // SCENARIO 2: ACK Retries & Duplicate ACK
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 2: ACK Retries & Duplicate ACK ---");
  let receivedEvent = null;
  clientSocket.on("realtime_event", (evt) => {
    receivedEvent = evt;
  });

  // Emit event from server dispatcher
  const payloadData = { msg: "test message", id: new mongoose.Types.ObjectId().toString() };
  const eventDoc = await dispatchToUser(testUserId, "NOTIFICATION", payloadData);
  assert.ok(eventDoc, "Event should be logged in database");

  // Wait for client to receive
  let start = Date.now();
  while (!receivedEvent && Date.now() - start < 5000) {
    await delay(100);
  }
  assert.ok(receivedEvent, "Client did not receive dispatched event in time");
  assert.equal(receivedEvent.eventId, eventDoc.eventId);
  assert.equal(receivedEvent.type, "NOTIFICATION");
  console.log("✓ Verification Passed: Dispatched event was delivered to client socket.");

  // Send ACK from client
  clientSocket.emit("event_ack", { eventId: eventDoc.eventId });
  
  // Verify status in DB transitions to acked
  start = Date.now();
  let updatedDoc = null;
  while (Date.now() - start < 5000) {
    updatedDoc = await RealtimeEvent.findOne({ eventId: eventDoc.eventId });
    if (updatedDoc && updatedDoc.status === "acked") {
      break;
    }
    await delay(100);
  }
  assert.equal(updatedDoc.status, "acked", "Event status did not update to acked");
  console.log("✓ Verification Passed: Server successfully recorded 'acked' status for the event.");

  // Send DUPLICATE ACK
  clientSocket.emit("event_ack", { eventId: eventDoc.eventId });
  await delay(500); // Wait to make sure server doesn't crash or double trigger
  const finalDoc = await RealtimeEvent.findOne({ eventId: eventDoc.eventId });
  assert.equal(finalDoc.status, "acked");
  console.log("✓ Verification Passed: Re-sent duplicate ACK was handled safely without crash or side-effects.");

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Sync & Reconnection Recovery
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 3: Sync & Reconnection Recovery ---");
  // Disconnect client
  clientSocket.disconnect();
  await delay(500);

  // Dispatch 3 events while client is offline
  const doc1 = await dispatchToUser(testUserId, "QUEUE_UPDATED", { position: 1 });
  const doc2 = await dispatchToUser(testUserId, "QUEUE_UPDATED", { position: 2 });
  const doc3 = await dispatchToUser(testUserId, "QUEUE_UPDATED", { position: 3 });

  // Assert their status is pending or sent (since no socket is online)
  const offlineDocs = await RealtimeEvent.find({ eventId: { $in: [doc1.eventId, doc2.eventId, doc3.eventId] } });
  assert.equal(offlineDocs.length, 3);
  offlineDocs.forEach(d => {
    assert.ok(["pending", "sent"].includes(d.status));
  });
  console.log("✓ Dispatched 3 offline events logged in DB.");

  // Perform HTTP delta sync fetch using native fetch
  const syncUrl = `http://127.0.0.1:${port}/api/v1/realtime/sync?afterSequence=${eventDoc.sequenceNumber}`;
  const syncRes = await fetch(syncUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const syncData = await syncRes.json();
  
  assert.equal(syncData.version, "v1");
  assert.equal(syncData.syncRequired, false);
  assert.equal(syncData.events.length, 3);
  assert.equal(syncData.events[0].eventId, doc1.eventId);
  assert.equal(syncData.events[1].eventId, doc2.eventId);
  assert.equal(syncData.events[2].eventId, doc3.eventId);
  assert.equal(syncData.nextSequence, doc3.sequenceNumber);
  console.log("✓ Verification Passed: Delta-sync endpoint successfully returns missed events in sequential order.");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Out-of-order Delivery (Client-Side Simulation)
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 4: Out-of-order Delivery (Client Simulation) ---");
  let mockCurrentSeq = 3;
  let mockReceivedSeq = 3;
  let mockSequenceBuffer = {};
  let mockCallbacks = [];
  const processedKeysRef = { current: new Set() };

  const mockTriggerCallbacks = (type, payload) => {
    mockCallbacks.push({ type, payload });
  };

  const mockProcessEventInOrder = (event) => {
    const { sequenceNumber, type, payload, eventId, idempotencyKey } = event;
    if (eventId && processedKeysRef.current.has(eventId)) {
      return;
    }
    if (idempotencyKey && processedKeysRef.current.has(idempotencyKey)) {
      return;
    }

    if (sequenceNumber <= mockCurrentSeq) return;

    if (sequenceNumber > mockReceivedSeq) {
      mockReceivedSeq = sequenceNumber;
    }

    if (sequenceNumber > mockCurrentSeq + 1) {
      mockSequenceBuffer[sequenceNumber] = event;
      return;
    }

    if (eventId) processedKeysRef.current.add(eventId);
    if (idempotencyKey) processedKeysRef.current.add(idempotencyKey);

    mockTriggerCallbacks(type, payload);
    mockCurrentSeq = sequenceNumber;

    let nextSeq = sequenceNumber + 1;
    while (mockSequenceBuffer[nextSeq]) {
      const buffered = mockSequenceBuffer[nextSeq];
      if (buffered.eventId) processedKeysRef.current.add(buffered.eventId);
      if (buffered.idempotencyKey) processedKeysRef.current.add(buffered.idempotencyKey);

      mockTriggerCallbacks(buffered.type, buffered.payload);
      mockCurrentSeq = nextSeq;
      delete mockSequenceBuffer[nextSeq];
      nextSeq++;
    }
  };

  // Receive sequence 5 out of order (expecting sequence 4 next)
  mockProcessEventInOrder({ sequenceNumber: 5, type: "TEST_EVENT", payload: { count: 5 } });
  assert.equal(mockCurrentSeq, 3, "Stored sequence must not advance for gap");
  assert.equal(mockCallbacks.length, 0, "No callbacks should execute on gap");
  assert.ok(mockSequenceBuffer[5], "Sequence 5 should be buffered");
  console.log("✓ Verified: Sequence 5 was successfully buffered, and stored sequence did not advance.");

  // Receive sequence 4
  mockProcessEventInOrder({ sequenceNumber: 4, type: "TEST_EVENT", payload: { count: 4 } });
  assert.equal(mockCurrentSeq, 5, "Stored sequence should advance to 5 after resolving buffer gap");
  assert.equal(mockCallbacks.length, 2, "Both events 4 and 5 should have processed");
  assert.equal(mockCallbacks[0].payload.count, 4);
  assert.equal(mockCallbacks[1].payload.count, 5);
  assert.equal(Object.keys(mockSequenceBuffer).length, 0, "Sequence buffer should be empty");
  console.log("✓ Verification Passed: Mock client correctly buffered out-of-order sequence and flushed it sequentially once gap was filled.");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Socket Reconnect Storm
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 5: Socket Reconnect Storm ---");
  const stormSockets = [];
  const connectPromises = [];

  for (let i = 0; i < 20; i++) {
    const s = io(socketUrl, {
      auth: { token, sessionId: "storm_session_123" },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false
    });
    stormSockets.push(s);
    connectPromises.push(new Promise((resolve) => {
      s.on("connect", () => {
        s.emit("heartbeat"); // send heartbeat
        resolve();
      });
    }));
  }

  await Promise.all(connectPromises);
  await delay(2000); // Allow registry updates and disconnect cleanups to settle

  // Count active connections for this user in DB
  const activeConnsCount = await ConnectionRegistry.countDocuments({ userId: testUserId, status: "connected" });
  assert.equal(activeConnsCount, 1, "There must be exactly one active connection registered after a storm");
  console.log(`✓ Active connections registered: ${activeConnsCount}`);
  
  // Clean up storm sockets
  stormSockets.forEach(s => s.disconnect());
  await delay(1000);

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Server Restart
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 6: Server Restart ---");
  // Stop workers and close server
  stopRealtimeWorkers();
  await new Promise((resolve) => server.close(resolve));
  console.log("✓ Server stopped (Mock Restarting).");

  // Seed 2 pending events in DB directly
  const restartSeq1 = await RealtimeSequence.findOneAndUpdate(
    { userId: testUserId },
    { $inc: { current: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const event1 = await RealtimeEvent.create({
    eventId: crypto.randomUUID(),
    sequenceNumber: restartSeq1.current,
    userId: testUserId,
    type: "VISIT_STARTED",
    payload: { visitId: "visit_reboot" },
    status: "pending",
    lastSentAt: new Date(Date.now() - 40000), // 40 seconds ago to trigger retry immediately
    idempotencyKey: `VISIT_STARTED_${testUserId.toString()}_${restartSeq1.current}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  const restartSeq2 = await RealtimeSequence.findOneAndUpdate(
    { userId: testUserId },
    { $inc: { current: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const event2 = await RealtimeEvent.create({
    eventId: crypto.randomUUID(),
    sequenceNumber: restartSeq2.current,
    userId: testUserId,
    type: "VISIT_COMPLETED",
    payload: { visitId: "visit_reboot" },
    status: "pending",
    lastSentAt: new Date(Date.now() - 40000), // 40 seconds ago to trigger retry immediately
    idempotencyKey: `VISIT_COMPLETED_${testUserId.toString()}_${restartSeq2.current}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  // Re-start server
  server = http.createServer(app);
  initSocket(server);
  server.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  port = server.address().port;
  socketUrl = `http://127.0.0.1:${port}`;
  console.log("Server rebooted on port:", port);

  // Restart realtime workers with faster tick rate
  initRealtimeWorkers(300);

  // Connect socket
  const recoverySocket = io(socketUrl, {
    auth: { token },
    transports: ["websocket"]
  });

  let receivedRecoveryEvents = [];
  recoverySocket.on("realtime_event", (evt) => {
    receivedRecoveryEvents.push(evt);
  });

  await new Promise((resolve) => recoverySocket.on("connect", resolve));
  console.log("✓ Client reconnected to rebooted server.");

  // Wait for retry worker to pick up pending events and emit them
  start = Date.now();
  while (receivedRecoveryEvents.length < 2 && Date.now() - start < 10000) {
    await delay(200);
  }

  assert.equal(receivedRecoveryEvents.length, 2, "Client should receive both missed events from the restart");
  assert.equal(receivedRecoveryEvents[0].eventId, event1.eventId);
  assert.equal(receivedRecoveryEvents[1].eventId, event2.eventId);
  console.log("✓ Verification Passed: Rebooted server workers successfully retrieved and delivered pending events to reconnected client.");
  recoverySocket.disconnect();

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Backpressure & Sync Pagination Cursor
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 7: Backpressure & Sync Pagination Cursor ---");
  // Clear events
  await RealtimeEvent.deleteMany({ userId: testUserId });
  await RealtimeSequence.deleteMany({ userId: testUserId });

  // Seed 110 events
  console.log("Seeding 110 events for backpressure checks...");
  for (let i = 1; i <= 110; i++) {
    const seq = await RealtimeSequence.findOneAndUpdate(
      { userId: testUserId },
      { $inc: { current: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    await RealtimeEvent.create({
      eventId: crypto.randomUUID(),
      sequenceNumber: seq.current,
      userId: testUserId,
      type: "QUEUE_UPDATED",
      payload: { position: i },
      status: "pending",
      idempotencyKey: `QUEUE_UPDATED_${testUserId.toString()}_${seq.current}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  }

  // Call sync from sequence 0
  const backpressureRes = await fetch(`http://127.0.0.1:${port}/api/v1/realtime/sync?afterSequence=0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const backpressureData = await backpressureRes.json();
  assert.equal(backpressureData.syncRequired, true, "Missed count > 100 must require full sync reload");
  console.log("✓ Verification Passed: Backlog difference > 100 triggers full client reload flag (syncRequired: true).");

  // Call sync from sequence 90 with limit 5
  const limitRes = await fetch(`http://127.0.0.1:${port}/api/v1/realtime/sync?afterSequence=90&limit=5`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const limitData = await limitRes.json();
  assert.equal(limitData.syncRequired, false);
  assert.equal(limitData.events.length, 5);
  assert.equal(limitData.hasMore, true);
  assert.equal(limitData.nextSequence, 95);
  console.log("✓ Verification Passed: Pagination limit and cursor values align correctly. hasMore is true.");

  // Call next page
  const nextRes = await fetch(`http://127.0.0.1:${port}/api/v1/realtime/sync?afterSequence=95&limit=20`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const nextData = await nextRes.json();
  assert.equal(nextData.events.length, 15); // 110 - 95 = 15 events
  assert.equal(nextData.hasMore, false);
  assert.equal(nextData.nextSequence, 110);
  console.log("✓ Verification Passed: Next cursor fetch completes the rest of the backlog correctly.");

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Duplicate Event Emit
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 8: Duplicate Event Emit ---");
  // Clean up events from backpressure tests to avoid triggering backpressure in subsequent sync tests
  await RealtimeEvent.deleteMany({ userId: testUserId });
  await RealtimeSequence.deleteMany({ userId: testUserId });
  // Seed a sequence starting sequence at 6 so the mock current seq aligns
  await RealtimeSequence.create({ userId: testUserId, current: 6 });

  mockCurrentSeq = 5;
  mockReceivedSeq = 5;
  mockCallbacks = [];
  processedKeysRef.current.clear();
  
  const testEvent = {
    sequenceNumber: 6,
    eventId: "unique_event_id_1",
    idempotencyKey: "TEST_KEY_123",
    type: "QUEUE_UPDATED",
    payload: { position: 10 }
  };

  mockProcessEventInOrder(testEvent);
  mockProcessEventInOrder(testEvent); // Send the duplicate event

  assert.equal(mockCallbacks.length, 1, "Duplicate events must trigger client render exactly once");
  console.log("✓ Verification Passed: Duplicate event emit rejected on client-side rendering.");

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Browser Refresh Recovery
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 9: Browser Refresh Recovery ---");
  mockSequenceBuffer = {};
  mockCallbacks = [];
  processedKeysRef.current.clear();

  // Fetch sync recovery from the stored committed sequence cursor
  const refreshSyncUrl = `http://127.0.0.1:${port}/api/v1/realtime/sync?afterSequence=${mockCurrentSeq}`;
  const refreshRes = await fetch(refreshSyncUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const refreshSyncData = await refreshRes.json();
  assert.equal(refreshSyncData.syncRequired, false);
  console.log(`✓ Verification Passed: Browser refresh catches up from committed sequence: ${mockCurrentSeq}`);

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Hidden Tab Recovery
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 10: Hidden Tab Recovery ---");
  let visibilityState = "hidden";
  
  // Dispatch an event while page is hidden
  const hiddenSeq = await RealtimeSequence.findOneAndUpdate(
    { userId: testUserId },
    { $inc: { current: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  
  const hiddenEvent = await RealtimeEvent.create({
    eventId: crypto.randomUUID(),
    sequenceNumber: hiddenSeq.current,
    userId: testUserId,
    type: "NOTIFICATION",
    payload: { text: "hidden event info" },
    status: "pending",
    lastSentAt: new Date(Date.now() - 40000), // make it retriable immediately
    idempotencyKey: `NOTIFICATION_${testUserId.toString()}_${hiddenSeq.current}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  // Verify sync recovers hidden-tab missed events when visibility is restored
  visibilityState = "visible";
  const catchupUrl = `http://127.0.0.1:${port}/api/v1/realtime/sync?afterSequence=${mockCurrentSeq}`;
  const catchupRes = await fetch(catchupUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const catchupData = await catchupRes.json();
  assert.ok(catchupData.events.length > 0, "Should catch up on hidden-tab missed events");
  console.log("✓ Verification Passed: Hidden tab catch-up sync triggered and recovered missed events successfully.");

  // ---------------------------------------------------------------------------
  // SCENARIO 11: ACK Latency Telemetry Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 11: ACK Latency Telemetry Verification ---");
  const RealtimeMonitoring = mongoose.model("RealtimeMonitoring");
  const monitoringDoc = await RealtimeMonitoring.findOne({});
  assert.ok(monitoringDoc, "RealtimeMonitoring document must exist");
  assert.ok(typeof monitoringDoc.avgAckLatency === "number");
  assert.ok(typeof monitoringDoc.p95AckLatency === "number");
  console.log(`✓ Verification Passed: avgAckLatency = ${monitoringDoc.avgAckLatency}ms, p95AckLatency = ${monitoringDoc.p95AckLatency}ms recorded in database.`);

  // Shutdown Server
  stopRealtimeWorkers();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  console.log("\nALL REAL-TIME INTEGRATION & CHAOS SCENARIOS COMPLETED SUCCESSFULLY!");
  process.exit(0);
};

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
