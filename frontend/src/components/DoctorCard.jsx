// ─── Format wait time exactly like real hospital boards ─────────────────────
const formatWait = (mins, sessionStatus) => {
  if (sessionStatus === "inactive") return { text: "Session not started", sub: null };
  if (sessionStatus === "closed")   return { text: "Closed today",        sub: null };
  if (sessionStatus === "paused")   return { text: "On break",            sub: "May be delayed" };

  const m = Math.round(mins ?? 0);
  if (m <= 0) return { text: "No wait",    sub: "Walk in now" };
  if (m < 60) return { text: `~${m} min`,  sub: m > 20 ? "Come on time" : "Be ready" };
  const h = Math.floor(m / 60);
  const r = m % 60;
  const label = r === 0 ? `~${h} hr` : `~${h} hr ${r} min`;
  return { text: label, sub: "You can arrive later" };
};

// ─── Session status chip styles ───────────────────────────────────────────────
const SESSION_CHIP = {
  active:   { label: "Live",        cls: "bg-green-100 text-green-700" },
  paused:   { label: "On Break",    cls: "bg-yellow-100 text-yellow-700" },
  inactive: { label: "Not Started", cls: "bg-gray-100 text-gray-500" },
  closed:   { label: "Closed",      cls: "bg-red-100 text-red-600" }
};

const AVAILABILITY_MAP = {
  available:   { label: "Accepting patients", cls: "bg-green-50 text-green-750 border border-green-200" },
  break:       { label: "On Break",            cls: "bg-yellow-50 text-yellow-800 border border-yellow-200" },
  delayed:     { label: "Delayed",            cls: "bg-red-50 text-rose-700 border border-rose-200 animate-pulse" },
  unavailable: { label: "Offline",            cls: "bg-gray-50 text-gray-500 border border-gray-200" }
};

export default function DoctorCard({ doctor, onBook }) {

  const doctorId      = doctor.id || doctor._id;
  const sessionStatus = doctor.sessionStatus || "inactive";
  const chip          = SESSION_CHIP[sessionStatus] || SESSION_CHIP.inactive;
  const wait          = formatWait(doctor.estimatedWaitTime, sessionStatus);
  const canBook       = doctor.isAvailable;

  const currentAvState = doctor.availabilityState || (doctor.isAvailable ? "available" : "unavailable");
  const avChip = AVAILABILITY_MAP[currentAvState] || AVAILABILITY_MAP.unavailable;

  return (
    <div className="bg-white shadow-sm rounded-xl p-5 mb-4 border border-gray-100 hover:shadow-md transition">

      {/* ── Top row: name + session chip + rating ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-start gap-3">
          {/* Avatar placeholder */}
          <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold flex-shrink-0">
            {doctor.name?.[0]?.toUpperCase() || "D"}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800 leading-tight">
              {doctor.name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{doctor.specialization}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Session status chip */}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.cls}`}>
            ● {chip.label}
          </span>
          {/* Availability badge */}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${avChip.cls}`}>
            {avChip.label}
          </span>
          {/* Rating */}
          {doctor.rating > 0 && (
            <span className="text-xs text-yellow-600 font-medium bg-yellow-50 px-2.5 py-1 rounded-full">
              ⭐ {doctor.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* ── Info row ──────────────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-500">

        {/* Queue load */}
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="font-medium text-gray-400 uppercase tracking-wider mb-0.5">Queue</p>
          <p className="text-gray-800 font-semibold text-sm">
            {doctor.queueLoad} patient{doctor.queueLoad !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Wait time — KEY FIX: always whole minutes, context-aware label */}
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="font-medium text-gray-400 uppercase tracking-wider mb-0.5">Est. Wait</p>
          <p className="text-gray-800 font-semibold text-sm">{wait.text}</p>
          {wait.sub && (
            <p className="text-gray-400 text-xs mt-0.5">{wait.sub}</p>
          )}
        </div>

        {/* Experience */}
        {doctor.experienceYears > 0 && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="font-medium text-gray-400 uppercase tracking-wider mb-0.5">Experience</p>
            <p className="text-gray-800 font-semibold text-sm">{doctor.experienceYears} yrs</p>
          </div>
        )}

      </div>

      {/* ── Paused/Break notices ────────────────────────────────────────────── */}
      {currentAvState === "break" && (
        <div className="mt-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-lg px-3 py-2.5">
          <strong>⏸️ Doctor is on break:</strong> {doctor.temporaryNotice?.message || "Away from desk."}
          {doctor.temporaryNotice?.expectedUntil && (
            <span className="block mt-1 text-gray-500 font-medium">
              Expected return: {new Date(doctor.temporaryNotice.expectedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* ── Delayed notice (Break expected return exceeded) ─────────────────── */}
      {currentAvState === "delayed" && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2.5 animate-pulse">
          <strong>⚠️ Delayed:</strong> The doctor's expected return time has passed. Notice: {doctor.temporaryNotice?.message || "Expected return exceeded."}
        </div>
      )}

      {/* ── Next Available slot info ────────────────────────────────────────── */}
      {!canBook && doctor.nextAvailable && (
        <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-3 py-2">
          📅 <strong>Next Available:</strong> {doctor.nextAvailable}
        </div>
      )}

      {/* ── Action row ────────────────────────────────────────────────────── */}
      <div className="mt-4 flex items-center justify-between">
        <span className={`text-xs font-medium ${canBook ? "text-green-600" : "text-red-500"}`}>
          {canBook ? "🟢 Accepting patients" : "🔴 Not accepting"}
        </span>

        <button
          onClick={() => onBook(doctorId)}
          disabled={!canBook}
          className={`
            px-5 py-2 rounded-lg text-sm font-medium transition shadow-sm
            ${canBook
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"}
          `}
        >
          {canBook ? "Book Now" : "Unavailable"}
        </button>
      </div>

    </div>
  );
}
