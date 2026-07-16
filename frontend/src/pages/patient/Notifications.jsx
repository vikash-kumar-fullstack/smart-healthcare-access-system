import { useEffect, useState } from "react";
import api from "../../services/api";
import NotificationCard from "../../components/NotificationCard";
import { useRealtime } from "../../components/RealtimeProvider";

export default function Notifications() {
  const { subscribe } = useRealtime() || {};
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      const rawData = res.data.data;
      const data = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.notifications)
          ? rawData.notifications
          : Array.isArray(rawData?.data)
            ? rawData.data
            : [];
      setNotifications(data);

      await api.patch("/notifications/read-all").catch((err) => console.error("Notifications page clear error:", err));
      window.dispatchEvent(new CustomEvent("notifications-updated"));
      setNotifications(prev => prev.map(n => ({ ...n, status: "read", isRead: true })));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleSync = () => {
      setNotifications(prev => prev.map(n => ({ ...n, status: "read", isRead: true })));
    };
    window.addEventListener("notifications-updated", handleSync);
    return () => window.removeEventListener("notifications-updated", handleSync);
  }, []);

  useEffect(() => {
    if (!subscribe) return;
    const unsub = subscribe("NOTIFICATION", () => {
      fetchNotifications();
    });
    return unsub;
  }, [subscribe]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm animate-pulse">
        Loading notifications...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">

      <h1 className="text-2xl font-bold mb-6">
        Notifications
      </h1>

      {notifications.length === 0 ? (

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
          No notifications yet
        </div>

      ) : (

        <div className="space-y-4">

          {notifications.map((notification) => (

            <NotificationCard
              key={notification._id}
              notification={notification}
            />

          ))}

        </div>
      )}

    </div>
  );
}
