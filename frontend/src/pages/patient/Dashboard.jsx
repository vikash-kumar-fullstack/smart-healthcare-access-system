import { useState, useEffect } from "react";
import api from "../../services/api";
import DoctorCard from "../../components/DoctorCard";
import StatCard from "../../components/StatCard";
import { StatCardSkeleton, DoctorCardSkeleton } from "../../components/Skeletons";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { X, Search } from "lucide-react";

export default function Home() {
  const [symptom, setSymptom] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [stats, setStats] = useState({
    activeQueue: 0,
    history: 0,
    notifications: 0
  });

  const navigate = useNavigate();

  // 🔹 BOOK FUNCTION
  const handleBook = async (doctorId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("Please login first");
      navigate("/login");
      return;
    }

    const loadingToast = toast.loading("Booking appointment...");

    try {
      await api.post("/queue/book", { doctorId });
      toast.success("Booking successful", { id: loadingToast });
      navigate("/patient/queue");
    } catch (err) {
      const alternateDoctor = err.response?.data?.data?.alternateDoctor;
      const message = alternateDoctor
        ? `${err.response.data.message} Try ${alternateDoctor.name}.`
        : err.response?.data?.message || "Booking failed";

      toast.error(message, { id: loadingToast });
    }
  };

  // 🔹 FETCH STATS
  const fetchDashboardData = async () => {
    try {
      setStatsLoading(true);
      const [queueRes, historyRes, notificationRes] = await Promise.all([
        api.get("/queue/my").catch(() => null),
        api.get("/queue/history"),
        api.get("/notifications")
      ]);

      setStats({
        activeQueue: queueRes?.data?.data ? 1 : 0,
        history: historyRes.data.data.length,
        notifications: notificationRes.data.data.filter((n) => !n.isRead).length
      });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Unable to refresh dashboard stats"
      );
    } finally {
      setStatsLoading(false);
    }
  };

  // 🔹 SEARCH FUNCTION
  const handleSearch = async () => {
    if (!symptom.trim()) {
      toast.error("Enter a symptom to search doctors");
      return;
    }

    const loadingToast = toast.loading("Searching doctors...");
    try {
      setSearchLoading(true);
      setSearched(true);
      const res = await api.post("/search/symptom", { symptom });
      const result = res.data.data;

      // 🔹 Suggestions
      if (result.type === "suggestions") {
        if (result.suggestions && result.suggestions.length > 0) {
          toast(
            `Did you mean: ${result.suggestions.join(", ")} ?`,
            { id: loadingToast }
          );
        } else {
          toast.error("No suggestions found for this symptom.", { id: loadingToast });
        }
        setDoctors([]);
        return;
      }

      // 🔹 Fuzzy Match
      if (result.type === "fuzzy") {
        toast.success(`Showing results for "${result.suggestion}"`, {
          id: loadingToast
        });
      } else if (result.doctors && result.doctors.length > 0) {
        toast.success(`${result.doctors.length} doctor(s) found`, {
          id: loadingToast
        });
      } else {
        toast.dismiss(loadingToast);
      }

      setDoctors(result.doctors || []);
    } catch (err) {
      console.error("ERROR 👉", err.response?.data || err.message);
      toast.error(
        err.response?.data?.message || "Something went wrong",
        { id: loadingToast }
      );
    } finally {
      setSearchLoading(false);
    }
  };

  // 🔹 CLEAR SEARCH
  const handleClearSearch = () => {
    setSymptom("");
    setDoctors([]);
    setSearched(false);
  };

  // 🔹 ENTER KEY SUPPORT
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* TITLE */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Welcome Back 👋</h1>
          <p className="text-gray-500 mt-2">
            Find doctors, manage queues, and track appointments.
          </p>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {statsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                title="Active Queue"
                value={stats.activeQueue}
                icon="⏳"
                color="border-blue-500"
              />
              <StatCard
                title="History"
                value={stats.history}
                icon="📜"
                color="border-green-500"
              />
              <StatCard
                title="Unread Notifications"
                value={stats.notifications}
                icon="🔔"
                color="border-red-500"
              />
            </>
          )}
        </div>

        {/* SEARCH BOX */}
        <div className="bg-white p-6 rounded-xl shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Find Doctor by Symptom</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <input
                className="
                  w-full border border-gray-300 rounded-lg
                  pl-10 pr-10 py-3
                  focus:outline-none
                  focus:ring-2
                  focus:ring-blue-500
                  transition-all duration-200
                "
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter symptom (e.g. fever, headache, joint pain)"
              />
              <Search className="absolute left-3.5 top-3.5 text-gray-400 w-5 h-5" />
              {symptom && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition"
                  title="Clear search"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <button
              disabled={searchLoading}
              onClick={handleSearch}
              className={`
                bg-blue-500 hover:bg-blue-600 active:scale-[0.98]
                transition-all duration-200 text-white px-6 py-3 rounded-lg font-medium
                whitespace-nowrap shadow-sm
                ${searchLoading ? "bg-gray-400 cursor-not-allowed" : ""}
              `}
            >
              {searchLoading ? "Searching..." : "Search Doctors"}
            </button>
          </div>
        </div>

        {/* RESULTS HEADER */}
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          {searched ? "Search Results" : "Available Doctors"}
        </h2>

        {/* RESULTS LIST */}
        <div className="space-y-4 mt-6">
          {searchLoading ? (
            <>
              <DoctorCardSkeleton />
              <DoctorCardSkeleton />
            </>
          ) : searched && doctors.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-10 text-center">
              <h2 className="text-xl font-semibold text-gray-700">No Doctors Found</h2>
              <p className="text-gray-500 mt-2">
                Try searching another symptom or click clear to show suggestions.
              </p>
            </div>
          ) : (
            doctors.map((doc) => (
              <DoctorCard
                key={doc.id || doc._id}
                doctor={doc}
                onBook={handleBook}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
