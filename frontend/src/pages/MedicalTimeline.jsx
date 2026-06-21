import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

export default function MedicalTimeline() {
  const [searchParams] = useSearchParams();
  const patientIdQuery = searchParams.get("patientId") || "";

  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [timelineData, setTimelineData] = useState({});
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchRole = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      setRole(u.role);
    }
  };

  const fetchTimeline = async (cursorVal = null) => {
    setLoading(true);
    try {
      const params = { limit: 10 };
      if (cursorVal) params.cursor = cursorVal;
      if (patientIdQuery) params.patientId = patientIdQuery;

      const response = await api.get("/medical-records/history", { params });
      const data = response.data.data;
      
      if (cursorVal) {
        // Merge with existing timeline data
        setTimelineData(prev => {
          const merged = { ...prev };
          Object.keys(data.records).forEach(year => {
            if (merged[year]) {
              merged[year] = [...merged[year], ...data.records[year]];
            } else {
              merged[year] = data.records[year];
            }
          });
          return merged;
        });
      } else {
        setTimelineData(data.records);
      }

      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load longitudinal timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRole();
  }, []);

  useEffect(() => {
    if (role) {
      fetchTimeline();
    }
  }, [role, patientIdQuery]);

  const handleLoadMore = () => {
    if (nextCursor) {
      fetchTimeline(nextCursor);
    }
  };

  const years = Object.keys(timelineData).sort((a, b) => parseInt(b) - parseInt(a));

  if (loading && Object.keys(timelineData).length === 0) {
    return (
      <div className="text-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Compiling medical timeline...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back to list link */}
      <Link to={role === "doctor" ? "/doctor/medical-records" : "/patient/medical-records"} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1 mb-6">
        ← Back to records
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
          Chronological Health Timeline
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          A longitudinal overview of patient visits and versioned medical records.
        </p>
      </div>

      {years.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-gray-500">
          <div className="text-5xl mb-4">⏳</div>
          <p className="font-bold text-lg text-gray-700">No timeline events found</p>
          <p className="text-sm text-gray-400 mt-1">Timeline entries will appear here once consultations are completed.</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-blue-100 ml-4 pl-8 space-y-12">
          {years.map(year => (
            <div key={year} className="relative">
              {/* Year marker bubble */}
              <div className="absolute -left-[45px] top-0 bg-blue-600 text-white font-black text-sm px-3 py-1 rounded-full shadow-md z-10">
                {year}
              </div>

              {/* Entries for this year */}
              <div className="space-y-6 pt-8">
                {timelineData[year].map(entry => (
                  <div key={entry._id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition relative">
                    {/* Event Connection Bullet */}
                    <div className="absolute -left-[41px] top-8 w-4 h-4 bg-white border-2 border-blue-600 rounded-full z-10" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">
                          Visit Summary
                        </span>
                        <h3 className="text-base font-bold text-gray-800 mt-1 capitalize">
                          {entry.activeVersion?.summary.chiefComplaint || "Routine Checkup"}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-gray-400">
                        {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2">
                      {entry.activeVersion?.summary.consultationSummary}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-4 mt-6 border-t pt-4 text-xs text-gray-500">
                      <div>
                        <span>Assigned practitioner: </span>
                        <span className="font-bold text-gray-700">Dr. {entry.doctorSnapshot.name}</span>
                      </div>
                      
                      <Link
                        to={role === "doctor" ? `/doctor/medical-records/${entry._id}` : `/patient/medical-records/${entry._id}`}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        View Full EMR →
                      </Link>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center mt-10">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-sm transition"
          >
            Load Older Timeline Entries
          </button>
        </div>
      )}

    </div>
  );
}
