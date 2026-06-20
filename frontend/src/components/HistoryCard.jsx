export default function HistoryCard({ item, onViewSummary }) {

  const getStatusColor = () => {

    switch (item.status) {

      case "completed":
        return "bg-green-100 text-green-700";

      case "cancelled":
        return "bg-red-100 text-red-700";

      case "skipped":
        return "bg-yellow-100 text-yellow-700";

      case "unavailable":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 border">

      {/* Top */}
      <div className="flex justify-between items-start">

        <div>

          <h2 className="text-lg font-semibold">
            {item.doctorName}
          </h2>

          <p className="text-sm text-gray-500">
            {item.specialization}
          </p>

        </div>

        <span
          className={`px-3 py-1 rounded-full text-sm ${getStatusColor()}`}
        >
          {item.status}
        </span>

      </div>

      {/* Info */}
      <div className="mt-4 space-y-2 text-sm text-gray-600">

        <p>
          🔢 Queue Number:
          <span className="font-medium ml-2">
            {item.queueNumber}
          </span>
        </p>

        <p>
          📅 Booked:
          <span className="font-medium ml-2">
            {new Date(item.bookedAt).toLocaleString()}
          </span>
        </p>

        {item.completedAt && (
          <p>
            ✅ Completed:
            <span className="font-medium ml-2">
              {new Date(item.completedAt).toLocaleString()}
            </span>
          </p>
        )}

        {item.cancelledAt && (
          <p>
            ❌ Cancelled:
            <span className="font-medium ml-2">
              {new Date(item.cancelledAt).toLocaleString()}
            </span>
          </p>
        )}

      </div>

      {item.visitId && item.status === "completed" && (
        <div className="mt-4 pt-3 border-t flex justify-end">
          <button
            onClick={() => onViewSummary(item.visitId)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-1.5 rounded-lg transition active:scale-95 flex items-center gap-1 shadow-sm"
          >
            <span>📋</span> View Medical Summary
          </button>
        </div>
      )}

    </div>
  );
}
