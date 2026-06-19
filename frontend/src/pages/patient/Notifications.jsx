import { useEffect, useState } from "react";
import api from "../../services/api";

import NotificationCard from "../../components/NotificationCard";

export default function Notifications() {

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {

    try {

      const res = await api.get("/notifications");

      setNotifications(res.data.data);

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {

    fetchNotifications();

  }, []);

  if (loading) {
    return (
      <div>
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

        <div className="bg-white p-6 rounded shadow text-gray-500">
          No notifications
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