import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

export default function RecordDetails() {
  const { id } = useParams();
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  // EMR Data
  const [record, setRecord] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [versions, setVersions] = useState([]);
  const [attachments, setAttachments] = useState([]);

  // Draft Edit Form (Autosave/Recovery support)
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    chiefComplaint: "",
    consultationSummary: "",
    doctorNotes: "",
    followUpAdvice: "",
    diagnosis: [],
    medications: []
  });

  const [diagnosisInput, setDiagnosisInput] = useState({ name: "", severity: "low", confidence: 100, notes: "" });
  const [medicationInput, setMedicationInput] = useState({ name: "", dosage: "", frequency: "", duration: "", instructions: "" });

  // Attachment Form
  const [attachmentForm, setAttachmentForm] = useState({
    fileName: "",
    mimeType: "application/pdf",
    size: 152400,
    storageKey: ""
  });

  // Selected Version to display (defaults to latest/active)
  const [displayVersionId, setDisplayVersionId] = useState("");

  const fetchRole = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      setRole(u.role);
      setUserId(u.userId);
    }
  };

  const fetchRecordDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/medical-records/${id}`);
      const data = response.data.data;
      setRecord(data.record);
      setActiveVersion(data.activeVersion);
      setVersions(data.versions);
      setAttachments(data.attachments);
      setDisplayVersionId(data.activeVersion?._id || "");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load medical record details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRole();
  }, []);

  useEffect(() => {
    if (id) {
      fetchRecordDetails();
    }
  }, [id]);

  // Draft recovery check on editMode trigger (Rule 6)
  useEffect(() => {
    if (editMode && record) {
      const draftKey = `medicalDraft_${record._id}`;
      const draftStr = localStorage.getItem(draftKey);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (Date.now() < draft.expiresAt) {
            setEditForm(draft.data);
            toast.success("Recovered unsaved draft changes.");
          } else {
            localStorage.removeItem(draftKey);
          }
        } catch (e) {
          localStorage.removeItem(draftKey);
        }
      } else {
        // Initialize with active version details
        setEditForm({
          chiefComplaint: activeVersion.summary.chiefComplaint,
          consultationSummary: activeVersion.summary.consultationSummary,
          doctorNotes: activeVersion.summary.doctorNotes,
          followUpAdvice: activeVersion.summary.followUpAdvice || "",
          diagnosis: activeVersion.diagnosis || [],
          medications: activeVersion.medications || []
        });
      }
    }
  }, [editMode, record, activeVersion]);

  // Autosave edit form data to localStorage (Rule 6)
  const handleFormChange = (updatedForm) => {
    setEditForm(updatedForm);
    if (record) {
      const draftKey = `medicalDraft_${record._id}`;
      localStorage.setItem(draftKey, JSON.stringify({
        savedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours expiry
        data: updatedForm
      }));
    }
  };

  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (record.status === "locked") {
      toast.error("Locked records cannot be edited.");
      return;
    }
    try {
      await api.patch(`/medical-records/${record._id}`, editForm);
      toast.success("Medical record updated to next version.");
      localStorage.removeItem(`medicalDraft_${record._id}`);
      setEditMode(false);
      fetchRecordDetails();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update record.");
    }
  };

  const handleArchive = async () => {
    try {
      await api.patch(`/medical-records/${record._id}/archive`);
      toast.success("Record status updated to archived.");
      fetchRecordDetails();
    } catch (err) {
      console.error(err);
      toast.error("Failed to archive record");
    }
  };

  const handleLock = async () => {
    try {
      await api.patch(`/medical-records/${record._id}/lock`);
      toast.success("Record locked permanently.");
      fetchRecordDetails();
    } catch (err) {
      console.error(err);
      toast.error("Failed to lock record");
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await api.get(`/medical-records/${record._id}/export`, { params: { format } });
      const data = response.data.data;
      if (format === "pdf_ready") {
        const printWindow = window.open("", "_blank");
        printWindow.document.write(data.pdfReadyHtml);
        printWindow.document.close();
        printWindow.print();
      } else {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `medical_record_export_${record._id}.json`;
        a.click();
        toast.success("Metadata JSON exported successfully.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Export compilation failed.");
    }
  };

  const handleUploadAttachment = async (e) => {
    e.preventDefault();
    if (!attachmentForm.fileName || !attachmentForm.storageKey) {
      toast.error("Filename and key cannot be empty.");
      return;
    }
    try {
      await api.post(`/medical-records/${record._id}/attachments`, {
        ...attachmentForm,
        version: record.latestVersion
      });
      toast.success("Attachment registered successfully.");
      setAttachmentForm({ fileName: "", mimeType: "application/pdf", size: 152400, storageKey: "" });
      fetchRecordDetails();
    } catch (err) {
      console.error(err);
      toast.error("Upload registration failed");
    }
  };

  const selectedDisplayVersion = versions.find(v => v._id === displayVersionId) || activeVersion;

  if (loading) {
    return (
      <div className="text-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Fetching chronological details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back Button */}
      <Link to={role === "doctor" ? "/doctor/medical-records" : "/patient/medical-records"} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1 mb-6">
        ← Back to list
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Record Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            
            {/* Header info */}
            <div className="flex flex-wrap justify-between items-start gap-3 border-b pb-4">
              <div>
                <span className="text-[10px] text-blue-500 uppercase tracking-widest font-extrabold">EMR Record Snapshot</span>
                <h2 className="text-2xl font-bold text-gray-800 mt-1 capitalize">
                  {selectedDisplayVersion?.summary.chiefComplaint}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Assigned Doctor: Dr. {record.doctorSnapshot.name} ({record.doctorSnapshot.specialization}) · {record.doctorSnapshot.hospitalName}
                </p>
              </div>

              <div className="flex gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                  record.status === "locked" ? "bg-red-50 text-red-600" : record.status === "archived" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"
                }`}>
                  {record.status}
                </span>
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-full text-xs font-bold">
                  v{selectedDisplayVersion?.version}
                </span>
              </div>
            </div>

            {/* Version Toggles details */}
            <div className="space-y-4 pt-2">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Clinical Summary Notes</span>
                <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border whitespace-pre-line leading-relaxed">
                  {selectedDisplayVersion?.summary.consultationSummary}
                </p>
              </div>

              {role === "doctor" && (
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Doctor Internal Vitals & Notes</span>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-amber-100/50 whitespace-pre-line leading-relaxed bg-amber-50/10">
                    {selectedDisplayVersion?.summary.doctorNotes}
                  </p>
                </div>
              )}

              {selectedDisplayVersion?.summary.followUpAdvice && (
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Follow Up & Advice</span>
                  <p className="text-sm text-indigo-700 bg-indigo-50/20 p-4 rounded-xl border border-indigo-100/40 leading-relaxed font-medium">
                    📌 {selectedDisplayVersion.summary.followUpAdvice}
                  </p>
                </div>
              )}
            </div>

            {/* Diagnosis Badges */}
            <div className="border-t pt-4">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Diagnoses</span>
              {selectedDisplayVersion?.diagnosis?.length === 0 ? (
                <p className="text-sm text-gray-400">No diagnoses recorded.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedDisplayVersion?.diagnosis?.map((d, i) => (
                    <div key={i} className="p-3 bg-blue-50/20 rounded-xl border border-blue-100/50 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 capitalize">{d.name}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          d.severity === "high" ? "bg-red-100 text-red-600" : d.severity === "medium" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                        }`}>
                          {d.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{d.notes || "No diagnosis notes"}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Confidence: {d.confidence}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medications Table */}
            <div className="border-t pt-4">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Medications Snapshot</span>
              {selectedDisplayVersion?.medications?.length === 0 ? (
                <p className="text-sm text-gray-400">No medications prescribed.</p>
              ) : (
                <div className="border rounded-xl overflow-hidden bg-gray-50/50">
                  <table className="w-full text-sm text-left text-gray-700">
                    <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-bold border-b">
                      <tr>
                        <th className="px-4 py-2">Medication</th>
                        <th className="px-4 py-2">Dosage</th>
                        <th className="px-4 py-2">Duration</th>
                        <th className="px-4 py-2">Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDisplayVersion?.medications?.map((m, i) => (
                        <tr key={i} className="border-b bg-white last:border-0">
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{m.name}</td>
                          <td className="px-4 py-2.5">{m.dosage} ({m.frequency})</td>
                          <td className="px-4 py-2.5">{m.duration}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{m.instructions || "None"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Attachments Section */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800">
              📁 Registered Medical Attachments
            </h3>
            
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-400">No files uploaded for this EMR version.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map(att => (
                  <div key={att._id} className="p-3 border rounded-xl flex items-center justify-between gap-4 bg-gray-50 hover:bg-gray-100/50 transition">
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-gray-700 truncate">{att.fileName}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{att.attachmentType} · {Math.round(att.size / 1024)} KB</p>
                    </div>
                    <span className="text-lg">📄</span>
                  </div>
                ))}
              </div>
            )}

            {/* Doctor Attachments Form */}
            {role === "doctor" && record.status !== "locked" && (
              <form onSubmit={handleUploadAttachment} className="border-t pt-4 space-y-3">
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Upload New Attachment Metadata</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Filename (e.g. blood_test.pdf)"
                    value={attachmentForm.fileName}
                    onChange={(e) => setAttachmentForm({ ...attachmentForm, fileName: e.target.value })}
                    className="px-3 py-1.5 border rounded-lg text-sm bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Storage Key (S3 key)"
                    value={attachmentForm.storageKey}
                    onChange={(e) => setAttachmentForm({ ...attachmentForm, storageKey: e.target.value })}
                    className="px-3 py-1.5 border rounded-lg text-sm bg-white"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold text-xs"
                  >
                    Register File Metadata
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Sidebar Actions & Versions */}
        <div className="space-y-6">
          
          {/* Actions Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800">
              EMR Actions
            </h3>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleExport("json")}
                className="w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition border text-sm flex items-center justify-center gap-2"
              >
                <span>💾</span> Export Metadata JSON
              </button>
              <button
                onClick={() => handleExport("pdf_ready")}
                className="w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition border text-sm flex items-center justify-center gap-2"
              >
                <span>🖨️</span> Export Printable HTML/PDF
              </button>
              
              {role === "doctor" && record.status !== "locked" && (
                <>
                  <button
                    onClick={() => setEditMode(true)}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition shadow-md text-sm"
                  >
                    Compose Edit (Version {record.latestVersion + 1})
                  </button>
                  <button
                    onClick={handleArchive}
                    className="w-full px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold rounded-xl transition text-sm"
                  >
                    Archive Record
                  </button>
                  <button
                    onClick={handleLock}
                    className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-xl transition text-sm"
                  >
                    Lock Permanently (Freeze Edits)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Versions Sidebar List */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800">
              Version History
            </h3>
            
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {versions.map(v => (
                <button
                  key={v._id}
                  onClick={() => setDisplayVersionId(v._id)}
                  className={`w-full p-3 text-left rounded-xl border transition ${
                    displayVersionId === v._id
                      ? "border-blue-600 bg-blue-50/20"
                      : "border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-gray-800">Version {v.version}</span>
                    {v.version === record.latestVersion && (
                      <span className="text-[9px] font-extrabold uppercase bg-green-50 text-green-600 px-1.5 py-0.5 rounded">Active</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 truncate">{v.summary.chiefComplaint}</p>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Edit/Update Draft Composer Modal */}
      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-50 border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Compose EMR Edit (Version {record.latestVersion + 1})
                </h3>
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Autosaving drafts enabled (Expires in 24h)</span>
              </div>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Chief Complaint</label>
                  <input
                    type="text"
                    required
                    value={editForm.chiefComplaint}
                    onChange={(e) => handleFormChange({ ...editForm, chiefComplaint: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Clinical Summary</label>
                  <textarea
                    required
                    rows="3"
                    value={editForm.consultationSummary}
                    onChange={(e) => handleFormChange({ ...editForm, consultationSummary: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Internal Doctor Notes</label>
                  <textarea
                    required
                    rows="2"
                    value={editForm.doctorNotes}
                    onChange={(e) => handleFormChange({ ...editForm, doctorNotes: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Follow-up Advice</label>
                  <input
                    type="text"
                    value={editForm.followUpAdvice}
                    onChange={(e) => handleFormChange({ ...editForm, followUpAdvice: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none"
                  />
                </div>

                {/* Edit Diagnoses */}
                <div className="border-t pt-4">
                  <span className="block text-sm font-bold text-gray-800 mb-2">Diagnoses List</span>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editForm.diagnosis.map((d, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        {d.name} ({d.severity})
                        <button type="button" onClick={() => handleFormChange({ ...editForm, diagnosis: editForm.diagnosis.filter((_, i) => i !== idx) })}>✕</button>
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
                      onClick={() => {
                        if (!diagnosisInput.name.trim()) return;
                        handleFormChange({
                          ...editForm,
                          diagnosis: [...editForm.diagnosis, { ...diagnosisInput, createdBy: userId }]
                        });
                        setDiagnosisInput({ name: "", severity: "low", confidence: 100, notes: "" });
                      }}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
                    >
                      Add Diagnosis
                    </button>
                  </div>
                </div>

                {/* Edit Medications */}
                <div className="border-t pt-4">
                  <span className="block text-sm font-bold text-gray-800 mb-2">Medications Prescribed</span>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editForm.medications.map((m, idx) => (
                      <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        {m.name} - {m.dosage} ({m.frequency})
                        <button type="button" onClick={() => handleFormChange({ ...editForm, medications: editForm.medications.filter((_, i) => i !== idx) })}>✕</button>
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
                      onClick={() => {
                        if (!medicationInput.name.trim() || !medicationInput.dosage.trim()) return;
                        handleFormChange({
                          ...editForm,
                          medications: [...editForm.medications, medicationInput]
                        });
                        setMedicationInput({ name: "", dosage: "", frequency: "", duration: "", instructions: "" });
                      }}
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
                  onClick={() => setEditMode(false)}
                  className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm"
                >
                  Save New Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
