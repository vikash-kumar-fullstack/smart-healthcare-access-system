import { useEffect, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";

import HistoryCard from "../../components/HistoryCard";

export default function History() {

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // EMR Modal states
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

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

  const handleViewSummary = async (visitId) => {
    setModalLoading(true);
    setModalOpen(true);
    setSelectedVisit(null);
    setSelectedSummary(null);
    try {
      const [visitRes, summaryRes] = await Promise.all([
        api.get(`/visits/${visitId}`),
        api.get(`/visits/${visitId}/summary`)
      ]);
      setSelectedVisit(visitRes.data.data.visit);
      setSelectedSummary(summaryRes.data.data.summary);
    } catch (err) {
      console.error("Failed to fetch visit details:", err);
      toast.error("Failed to load medical summary.");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Clinical Consultation History
      </h1>

      {history.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-semibold text-gray-700">No history found</p>
          <p className="text-sm text-gray-400 mt-1">Your past clinical bookings and visits will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <HistoryCard
              key={item.queueId}
              item={item}
              onViewSummary={handleViewSummary}
            />
          ))}
        </div>
      )}

      {/* ── EMR Summary Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gray-50 border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
                  <span>📋</span> EMR Medical Summary
                </h3>
                {selectedVisit && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    Visit ID: {selectedVisit.publicId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 transition"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              {modalLoading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Fetching EMR record...</p>
                </div>
              ) : selectedVisit ? (
                <>
                  {/* Doctor Snapshot Card */}
                  <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-4 rounded-xl border border-blue-100/50">
                    <p className="text-[10px] text-blue-500 uppercase tracking-widest font-bold">Assigned Practitioner</p>
                    <h4 className="text-base font-bold text-gray-800 mt-0.5">Dr. {selectedVisit.doctorSnapshot.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedVisit.doctorSnapshot.specialization} · {selectedVisit.doctorSnapshot.hospitalName}</p>
                  </div>

                  {/* EMR Data Blocks */}
                  <div className="space-y-4">
                    {/* Chief Complaint */}
                    <div className="space-y-1">
                      <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Chief Complaint</span>
                      <p className="text-sm font-semibold text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">{selectedSummary?.chiefComplaint || "N/A"}</p>
                    </div>

                    {/* Consultation Summary */}
                    <div className="space-y-1">
                      <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Clinical Summary</span>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-line leading-relaxed">{selectedSummary?.consultationSummary || "N/A"}</p>
                    </div>

                    {/* Doctor Notes (only visible if visible to patient) */}
                    {selectedSummary?.visibility === "patient" && (
                      <div className="space-y-1">
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Vitals & Clinical Notes</span>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-line leading-relaxed">{selectedSummary?.doctorNotes || "N/A"}</p>
                      </div>
                    )}

                    {/* Follow-up Advice */}
                    {selectedSummary?.followUpAdvice && (
                      <div className="space-y-1">
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Follow-up & Advice</span>
                        <p className="text-sm text-indigo-700 bg-indigo-50/30 p-3 rounded-lg border border-indigo-100/50 whitespace-pre-line leading-relaxed">
                          📌 {selectedSummary.followUpAdvice}
                        </p>
                      </div>
                    )}

                    {/* Meta Detail Cards */}
                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span className="block text-gray-400 font-bold uppercase tracking-wider text-[9px]">Visit Outcome</span>
                        <span className="font-semibold text-gray-700 mt-0.5 capitalize">{selectedVisit.visitOutcome?.replace(/_/g, " ") || "N/A"}</span>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span className="block text-gray-400 font-bold uppercase tracking-wider text-[9px]">EMR Record Version</span>
                        <span className="font-semibold text-blue-600 mt-0.5">Version {selectedVisit.latestSummaryVersion} (Active)</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">No EMR summary details available.</p>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-sm transition"
              >
                Close Summary
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}