import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const RealtimeContext = createContext(null);

export const useRealtime = () => useContext(RealtimeContext);

const TAB_ID = Math.random().toString(36).substring(2, 11);
const LEADER_KEY = "realtime_leader_tab";
const TABS_KEY = "realtime_active_tabs";

export const RealtimeProvider = ({ children }) => {
  const [connectionState, setConnectionState] = useState("OFFLINE"); // LIVE, RECONNECTING, SYNCING, OFFLINE
  const [isLeader, setIsLeader] = useState(false);
  const socketRef = useRef(null);
  const listenersRef = useRef({});
  const sequenceBufferRef = useRef({});
  const processedKeysRef = useRef(new Set());

  const getUserIdFromToken = (tokenVal) => {
    if (!tokenVal) {
      try {
        const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");
        return cachedUser._id || cachedUser.id || null;
      } catch {
        return null;
      }
    }
    try {
      const parts = tokenVal.split(".");
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        return decoded.userId || decoded.id || null;
      }
    } catch {}
    return null;
  };

  // Get current auth info
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [userId, setUserId] = useState(() => getUserIdFromToken(localStorage.getItem("token")));

  useEffect(() => {
    const checkAuth = () => {
      const curToken = localStorage.getItem("token");
      const curUserId = getUserIdFromToken(curToken);
      if (curToken !== token) {
        setToken(curToken);
      }
      if (curUserId !== userId) {
        setUserId(curUserId);
      }
    };
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, [token, userId]);

  const getStoredCommittedSeq = () => {
    const key = userId ? `realtime_last_committed_${userId}` : "";
    return key ? parseInt(localStorage.getItem(key)) || 0 : 0;
  };

  const setStoredCommittedSeq = (seq) => {
    const key = userId ? `realtime_last_committed_${userId}` : "";
    if (key) {
      localStorage.setItem(key, seq.toString());
    }
  };

  const getStoredReceivedSeq = () => {
    const key = userId ? `realtime_last_received_${userId}` : "";
    return key ? parseInt(localStorage.getItem(key)) || 0 : 0;
  };

  const setStoredReceivedSeq = (seq) => {
    const key = userId ? `realtime_last_received_${userId}` : "";
    if (key) {
      localStorage.setItem(key, seq.toString());
    }
  };

  // Broadcast channel for multi-tab updates
  const channelRef = useRef(null);
  if (!channelRef.current) {
    channelRef.current = new BroadcastChannel("realtime_sync");
  }

  // Register listener helper
  const subscribe = (eventType, callback) => {
    if (!listenersRef.current[eventType]) {
      listenersRef.current[eventType] = new Set();
    }
    listenersRef.current[eventType].add(callback);
    return () => {
      listenersRef.current[eventType].delete(callback);
    };
  };

  // Trigger local event callbacks
  const triggerCallbacks = (type, payload) => {
    const callbacks = listenersRef.current[type];
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in realtime listener callback for ${type}:`, err);
        }
      });
    }
  };

  // Leader Election Logic
  useEffect(() => {
    if (!token) {
      setIsLeader(false);
      return;
    }

    const updateRegistryAndCheckLeader = () => {
      const now = Date.now();
      let tabs;
      try {
        tabs = JSON.parse(localStorage.getItem(TABS_KEY)) || {};
      } catch {
        tabs = {};
      }

      // 1. Keep ourselves alive
      tabs[TAB_ID] = now;

      // 2. Filter out stale tabs (> 5 seconds inactive)
      Object.keys(tabs).forEach(id => {
        if (now - tabs[id] > 5000) {
          delete tabs[id];
        }
      });

      localStorage.setItem(TABS_KEY, JSON.stringify(tabs));

      // 3. Lowest alphabetic tabId is elected leader
      const activeIds = Object.keys(tabs).sort();
      const currentLeader = activeIds[0];
      const amILeader = currentLeader === TAB_ID;

      setIsLeader(amILeader);
      localStorage.setItem(LEADER_KEY, currentLeader);
    };

    updateRegistryAndCheckLeader();
    const interval = setInterval(updateRegistryAndCheckLeader, 2000);

    // Cleanup tab on close
    const handleUnload = () => {
      let tabs;
      try {
        tabs = JSON.parse(localStorage.getItem(TABS_KEY)) || {};
      } catch {
        tabs = {};
      }
      delete tabs[TAB_ID];
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [token]);

  // Execute sync recovery via GET API
  const performSync = async () => {
    if (!token || !userId) return;
    setConnectionState("SYNCING");

    const currentSeq = getStoredCommittedSeq();
    try {
      const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
      const res = await axios.get(`${socketUrl}/realtime/sync`, {
        params: { afterSequence: currentSeq, limit: 50 },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.syncRequired) {
        console.warn("[REALTIME SYNC] Backpressure limit exceeded. Resetting sequence and triggering page reload.");
        const cKey = userId ? `realtime_last_committed_${userId}` : "";
        if (cKey) localStorage.removeItem(cKey);
        const rKey = userId ? `realtime_last_received_${userId}` : "";
        if (rKey) localStorage.removeItem(rKey);
        window.location.reload();
        return;
      }

      // Process caught-up events in order
      const events = res.data.events || [];
      for (const evt of events) {
        processEventInOrder(evt);
      }

      setConnectionState("LIVE");
    } catch (err) {
      console.error("[REALTIME SYNC] Recovery failed:", err);
      setConnectionState("OFFLINE");
    }
  };

  // Reorder and advance sequence safety
  const processEventInOrder = (event) => {
    const { sequenceNumber, type, payload, eventId, idempotencyKey } = event;
    const committedSeq = getStoredCommittedSeq();

    // Deduplication check via event IDs or keys
    if (eventId && processedKeysRef.current.has(eventId)) {
      return;
    }
    if (idempotencyKey && processedKeysRef.current.has(idempotencyKey)) {
      return;
    }

    if (sequenceNumber <= committedSeq) {
      return;
    }

    // Update last received sequence cursor
    const receivedSeq = getStoredReceivedSeq();
    if (sequenceNumber > receivedSeq) {
      setStoredReceivedSeq(sequenceNumber);
    }

    // Gap check
    if (sequenceNumber > committedSeq + 1) {
      // Buffer it
      sequenceBufferRef.current[sequenceNumber] = event;
      // Trigger a delayed recovery if the gap isn't filled within 1.5 seconds
      setTimeout(() => {
        if (getStoredCommittedSeq() < sequenceNumber) {
          performSync();
        }
      }, 1500);
      return;
    }

    // Track processed event keys/IDs
    if (eventId) processedKeysRef.current.add(eventId);
    if (idempotencyKey) processedKeysRef.current.add(idempotencyKey);

    // Process this event
    triggerCallbacks(type, payload);
    setStoredCommittedSeq(sequenceNumber);

    // Recursively check buffer
    let nextSeq = sequenceNumber + 1;
    while (sequenceBufferRef.current[nextSeq]) {
      const bufferedEvent = sequenceBufferRef.current[nextSeq];

      if (bufferedEvent.eventId) processedKeysRef.current.add(bufferedEvent.eventId);
      if (bufferedEvent.idempotencyKey) processedKeysRef.current.add(bufferedEvent.idempotencyKey);

      triggerCallbacks(bufferedEvent.type, bufferedEvent.payload);
      setStoredCommittedSeq(nextSeq);
      delete sequenceBufferRef.current[nextSeq];
      nextSeq++;
    }
  };

  // Socket connection lifecycle (Leader only)
  useEffect(() => {
    if (!token || !isLeader) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (token && !isLeader) {
        setConnectionState("LIVE"); // Sub-tab relies on leader, label as active
      } else {
        setConnectionState("OFFLINE");
      }
      return;
    }

    setConnectionState("RECONNECTING");
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
      : "http://localhost:5000";

    let sessionId = localStorage.getItem("realtime_session_id");
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("realtime_session_id", sessionId);
    }

    const socket = io(socketUrl, {
      auth: { token, sessionId, deviceId: "web_browser" },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[REALTIME LEADER] Connected socket ID:", socket.id);
      performSync();
    });

    socket.on("realtime_event", (event) => {
      // 1. Process locally in order
      processEventInOrder(event);

      // 2. Broadcast to other tabs
      channelRef.current.postMessage({ type: "event", data: event });

      // 3. ACK back to server
      socket.emit("event_ack", { eventId: event.eventId });
    });

    socket.on("connect_error", (err) => {
      console.error("[REALTIME LEADER] Connection error:", err.message);
      setConnectionState("OFFLINE");
    });

    socket.on("disconnect", () => {
      console.log("[REALTIME LEADER] Disconnected.");
      setConnectionState("OFFLINE");
    });

    // Send heartbeats every 15s to keep registry fresh
    const heartbeatTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat");
      }
    }, 15000);

    return () => {
      clearInterval(heartbeatTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, isLeader]);

  // Listener for BroadcastChannel (Secondary tabs)
  useEffect(() => {
    const handleBroadcast = (msg) => {
      if (msg.data && msg.data.type === "event" && !isLeader) {
        processEventInOrder(msg.data.data);
      }
    };

    channelRef.current.addEventListener("message", handleBroadcast);
    return () => {
      channelRef.current.removeEventListener("message", handleBroadcast);
    };
  }, [isLeader]);

  // Visibility change handling (Pause background rendering / fetch catch-up sync)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && token) {
        console.log("[REALTIME PROVIDER] Tab focused. Performing catch-up sync...");
        performSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [token]);

  return (
    <RealtimeContext.Provider value={{ subscribe, connectionState, performSync }}>
      {children}
    </RealtimeContext.Provider>
  );
};
