// UX Experience Telemetry System

const isDev = import.meta.env.DEV;

// Initialize global metrics store if in dev mode
if (isDev && typeof window !== "undefined") {
  window.__UX_METRICS__ = {
    landing_mounted_at: null,
    landing_to_search: null,
    login_started_at: null,
    login_time: null,
    dashboard_mounted_at: null,
    dashboard_ready: null,
    queue_visible: null,
    logs: []
  };
}

export const recordEvent = (eventName, value = null) => {
  if (!isDev || typeof window === "undefined") return;

  const store = window.__UX_METRICS__;
  if (!store) return;

  const now = performance.now();
  store.logs.push({ eventName, timestamp: now, value });

  switch (eventName) {
    case "landing_mount":
      store.landing_mounted_at = now;
      break;

    case "landing_search":
      if (store.landing_mounted_at) {
        store.landing_to_search = Math.round(now - store.landing_mounted_at);
      }
      break;

    case "login_start":
      store.login_started_at = now;
      break;

    case "login_success":
      if (store.login_started_at) {
        store.login_time = Math.round(now - store.login_started_at);
      }
      break;

    case "dashboard_mount":
      store.dashboard_mounted_at = now;
      break;

    case "dashboard_data_loaded":
      if (store.dashboard_mounted_at) {
        store.dashboard_ready = Math.round(now - store.dashboard_mounted_at);
      }
      break;

    case "queue_visibility_changed":
      if (store.dashboard_mounted_at) {
        store.queue_visible = Math.round(now - store.dashboard_mounted_at);
      }
      break;

    default:
      break;
  }
};

export const getMetrics = () => {
  if (typeof window !== "undefined") {
    return window.__UX_METRICS__ || {};
  }
  return {};
};
