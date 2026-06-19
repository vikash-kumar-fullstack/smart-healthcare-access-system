import { useEffect, useState } from "react";
import api from "../../services/api";

import HistoryCard from "../../components/HistoryCard";

export default function History() {

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {

    try {

      const res = await api.get("/queue/history");

      setHistory(res.data.data);

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {

    fetchHistory();

  }, []);

  if (loading) {
    return (
      <div>
        Loading history...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">

      <h1 className="text-2xl font-bold mb-6">
        Queue History
      </h1>

      {history.length === 0 ? (

        <div className="bg-white p-6 rounded shadow text-gray-500">
          No history found
        </div>

      ) : (

        <div className="space-y-4">

          {history.map((item) => (

            <HistoryCard
              key={item.queueId}
              item={item}
            />

          ))}

        </div>
      )}

    </div>
  );
}