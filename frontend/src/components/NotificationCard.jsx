export default function NotificationCard({ notification }) {

  const getTypeColor = () => {

    switch (notification.type) {

      case "alert":
        return "bg-red-100 text-red-700";

      case "update":
        return "bg-blue-100 text-blue-700";

      case "success":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className={`
      bg-white shadow rounded-lg p-4 border
      ${!notification.isRead ? "border-blue-400" : ""}
    `}>

      {/* Top */}
      <div className="flex justify-between items-start">

        <div>

          <h2 className="text-lg font-semibold">
            {notification.title}
          </h2>

          <p className="text-sm text-gray-600 mt-1">
            {notification.message}
          </p>

        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs ${getTypeColor()}`}
        >
          {notification.type}
        </span>

      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-between items-center text-sm text-gray-400">

        <span>
          {new Date(notification.createdAt).toLocaleString()}
        </span>

        {!notification.isRead && (
          <span className="text-blue-500 font-medium">
            New
          </span>
        )}

      </div>

    </div>
  );
}