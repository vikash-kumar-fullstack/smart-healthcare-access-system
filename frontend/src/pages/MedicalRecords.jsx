import { useState, useEffect } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

export default function MedicalRecords() {
  const [role, setRole] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patients, setPatients] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState("");

  // Filter States
  const [diagnosisFilter, setDiagnosisFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRecordData, setNewRecordData] = useState({
    patientId: "",
    chiefComplaint: "",
    consultationSummary: "",
    doctorNotes: "",
    followUpAdvice: "",
    diagnosis: [],
    medications: [],
    visibilityRules: {
      visibleToPatient: true,
      visibleToDoctor: true,
      containsInternalNotes: false
    }
  });

  const [diagnosisInput, setDiagnosisInput] = useState({ name: "", severity: "low", confidence: 100, notes: "" });
  const [medicationInput, setMedicationInput] = useState({ name: "", dosage: "", frequency: "", duration: "", instructions: "" });

  const fetchUserRole = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      setRole(u.role);
      if (u.role === "patient") {
        setSelectedPatientId(u.userId);
      }
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.q = searchQuery;
      if (diagnosisFilter) params.diagnosis = diagnosisFilter;
      if (dateFilter) params.date = dateFilter;
      if (outcomeFilter) params.outcome = outcomeFilter;
      if (role === "doctor" && selectedPatientId) {
        params.patientId = selectedPatientId;
      }

      const response = await api.get("/medical-records/search", { params });
      setRecords(response.data.data.records);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load medical records");
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async () => {
    if (!patientSearchTerm.trim()) return;
    setSearchLoading(true);
    try {
      // Find matching patient users
      const response = await api.get(`/admin/users?role=patient`);
      const filtered = response.data.data.users.filter(u =>
        u.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        u.phone?.includes(patientSearchTerm)
      );
      setPatients(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (role) {
      fetchRecords();
    }
  }, [role, selectedPatientId, searchQuery, diagnosisFilter, dateFilter, outcomeFilter]);

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!newRecordData.patientId) {
      toast.error("Please select a patient first.");
      return;
    }
    try {
      await api.post("/medical-records", newRecordData);
      toast.success("Medical record created successfully.");
      setCreateModalOpen(false);
      setNewRecordData({
        patientId: "",
        chiefComplaint: "",
        consultationSummary: "",
        doctorNotes: "",
        followUpAdvice: "",
        diagnosis: [],
        medications: [],
        visibilityRules: {
          visibleToPatient: true,
          visibleToDoctor: true,
          containsInternalNotes: false
        }
      });
      fetchRecords();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create medical record.");
    }
  };

  const addDiagnosis = () => {
    if (!diagnosisInput.name.trim()) return;
    setNewRecordData(prev => ({
      ...prev,
      diagnosis: [...prev.diagnosis, { ...diagnosisInput, createdBy: selectedPatientId || "system" }]
    }));
    setDiagnosisInput({ name: "", severity: "low", confidence: 100, notes: "" });
  };

  const addMedication = () => {
    if (!medicationInput.name.trim() || !medicationInput.dosage.trim()) return;
    setNewRecordData(prev => ({
      ...prev,
      medications: [...prev.medications, medicationInput]
    }));
    setMedicationInput({ name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            EMR Medical Records
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Access secure, version-controlled longitudinal health records.
          </p>
        </div>

        {role === "doctor" && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (!selectedPatientId) {
                  toast.error("Select a patient to compose manual record.");
                  return;
                }
                setNewRecordData(prev => ({ ...prev, patientId: selectedPatientId }));
                setCreateModalOpen(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition duration-200"
            >
              Compose EMR Record
            </button>
            <Link
              to={role === "doctor" ? `/doctor/timeline?patientId=${selectedPatientId}` : "/patient/timeline"}
              className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-sm transition duration-200 flex items-center gap-1.5"
            >
              <span>📅</span> View Patient Timeline
            </Link>
          </div>
        )}
      </div>

      {/* Doctor Patient Selector */}
      {role === "doctor" && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6 space-y-4">
          <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
            Select Patient
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search patient by name, email or phone..."
              value={patientSearchTerm}
              onChange={(e) => setPatientSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={searchPatients}
              disabled={searchLoading}
              className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl transition"
            >
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {patients.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {patients.map(p => (
                <button
                  key={p._id}
                  onClick={() => {
                    setSelectedPatientId(p._id);
                    setPatients([]);
                    setPatientSearchTerm(p.name);
                    toast.success(`Selected patient: ${p.name}`);
                  }}
                  className={`p-3 text-left rounded-xl border transition ${selectedPatientId === p._id
                      ? "border-blue-600 bg-blue-50/20"
                      : "border-gray-100 hover:bg-gray-50"
                    }`}
                >
                  <p className="font-bold text-sm text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.email || p.phone}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Search Text</label>
          <input
            type="text"
            placeholder="Search symptoms, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl focus:outline-none bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Diagnosis</label>
          <input
            type="text"
            placeholder="e.g. Migraine"
            value={diagnosisFilter}
            onChange={(e) => setDiagnosisFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl focus:outline-none bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl focus:outline-none bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Outcome</label>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-xl focus:outline-none bg-white"
          >
            <option value="">All Outcomes</option>
            <option value="consulted">Consulted</option>
            <option value="follow_up_required">Follow up required</option>
            <option value="referred">Referred</option>
          </select>
        </div>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Searching records database...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border text-center text-gray-500">
          <div className="text-5xl mb-4">📂</div>
          <p className="font-bold text-lg text-gray-700">No medical records found</p>
          <p className="text-sm text-gray-400 mt-1">Refine your search keywords or select another patient filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {records.map(rec => (
            <div key={rec._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow relative">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <span className="inline-block text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Version v{rec.latestVersion}
                  </span>
                  <h3 className="text-base font-bold text-gray-800 mt-1.5 capitalize">
                    {rec.activeVersion?.summary.chiefComplaint || "No chief complaint"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Created: {new Date(rec.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${rec.status === "locked"
                    ? "bg-red-50 text-red-600"
                    : rec.status === "archived"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-green-50 text-green-600"
                  }`}>
                  {rec.status}
                </span>
              </div>

              <div className="space-y-2 border-t pt-4 text-sm">
                <div>
                  <span className="text-xs font-semibold text-gray-400">Practitioner:</span>
                  <span className="font-medium text-gray-700 ml-1">Dr. {rec.doctorSnapshot.name}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400">Diagnosis:</span>
                  <span className="text-gray-700 ml-1">
                    {rec.activeVersion?.diagnosis.map(d => d.name).join(", ") || "None recorded"}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Link
                  to={role === "doctor" ? `/doctor/medical-records/${rec._id}` : `/patient/medical-records/${rec._id}`}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold rounded-xl transition"
                >
                  View Details & History →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose record modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-50 border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
                <span>📋</span> Compose Medical Record
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Chief Complaint</label>
                  <input
                    type="text"
                    required
                    value={newRecordData.chiefComplaint}
                    onChange={(e) => setNewRecordData({ ...newRecordData, chiefComplaint: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Clinical Summary</label>
                  <textarea
                    required
                    rows="3"
                    value={newRecordData.consultationSummary}
                    onChange={(e) => setNewRecordData({ ...newRecordData, consultationSummary: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Internal Doctor Notes</label>
                  <textarea
                    required
                    rows="2"
                    value={newRecordData.doctorNotes}
                    onChange={(e) => setNewRecordData({ ...newRecordData, doctorNotes: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Follow-up Advice</label>
                  <input
                    type="text"
                    value={newRecordData.followUpAdvice}
                    onChange={(e) => setNewRecordData({ ...newRecordData, followUpAdvice: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                {/* Add Diagnosis Section */}
                <div className="border-t pt-4">
                  <span className="block text-sm font-bold text-gray-800 mb-2">Diagnoses List</span>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newRecordData.diagnosis.map((d, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        {d.name} ({d.severity})
                        <button type="button" onClick={() => setNewRecordData(prev => ({ ...prev, diagnosis: prev.diagnosis.filter((_, i) => i !== idx) }))}>✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl">
                    <input
                      type="text"
                      placeholder="Diagnosis Name"
                      value={diagnosisInput.name}
                      onChange={(e) => setDiagnosisInput({ ...diagnosisInput, name: e.target.value })}
                      className="px-3 py-1.5 border rounded-lg bg-white"
                    />
                    <select
                      value={diagnosisInput.severity}
                      onChange={(e) => setDiagnosisInput({ ...diagnosisInput, severity: e.target.value })}
                      className="px-3 py-1.5 border rounded-lg bg-white"
                    >
                      <option value="low">Low Severity</option>
                      <option value="medium">Medium Severity</option>
                      <option value="high">High Severity</option>
                    </select>
                    <button
                      type="button"
                      onClick={addDiagnosis}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
                    >
                      Add Diagnosis
                    </button>
                  </div>
                </div>

                {/* Add Medication Section */}
                <div className="border-t pt-4">
                  <span className="block text-sm font-bold text-gray-800 mb-2">Medications Prescribed</span>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newRecordData.medications.map((m, idx) => (
                      <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        {m.name} - {m.dosage} ({m.frequency})
                        <button type="button" onClick={() => setNewRecordData(prev => ({ ...prev, medications: prev.medications.filter((_, i) => i !== idx) }))}>✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl">
                    <input
                      type="text"
                      placeholder="Med Name"
                      value={medicationInput.name}
                      onChange={(e) => setMedicationInput({ ...medicationInput, name: e.target.value })}
                      className="px-3 py-1.5 border rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={medicationInput.dosage}
                      onChange={(e) => setMedicationInput({ ...medicationInput, dosage: e.target.value })}
                      className="px-3 py-1.5 border rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={medicationInput.frequency}
                      onChange={(e) => setMedicationInput({ ...medicationInput, frequency: e.target.value })}
                      className="px-3 py-1.5 border rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={addMedication}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm"
                    >
                      Add Med
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm"
                >
                  Save EMR Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
