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
  active:   { label: "Live",        cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  paused:   { label: "On Break",    cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  inactive: { label: "Not Started", cls: "bg-slate-100 text-slate-600 border border-slate-200" },
  closed:   { label: "Closed",      cls: "bg-rose-50 text-rose-700 border border-rose-100" }
};

const AVAILABILITY_MAP = {
  available:   { label: "Accepting patients", cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  break:       { label: "On Break",            cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  delayed:     { label: "Delayed",            cls: "bg-rose-50 text-rose-700 border border-rose-100" },
  unavailable: { label: "Offline",            cls: "bg-slate-100 text-slate-500 border border-slate-200" }
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
    <div className="bg-white rounded-lg p-5 mb-4 border border-slate-200 hover:border-slate-300 transition shadow-sm">

      {/* ── Top row: name + session chip + rating ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-base font-bold flex-shrink-0 border border-slate-200">
            {doctor.name?.[0]?.toUpperCase() || "D"}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 leading-tight">
              {doctor.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{doctor.specialization}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Session status chip */}
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${chip.cls}`}>
            {chip.label}
          </span>
          {/* Availability badge */}
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${avChip.cls}`}>
            {avChip.label}
          </span>
          {/* Rating */}
          {doctor.rating > 0 && (
            <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
              ★ {doctor.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* ── Info row ──────────────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">

        {/* Queue load */}
        <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
          <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Queue</p>
          <p className="text-slate-800 font-bold text-xs">
            {doctor.queueLoad} patient{doctor.queueLoad !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Wait time */}
        <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
          <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Est. Wait</p>
          <p className="text-slate-800 font-bold text-xs">{wait.text}</p>
          {wait.sub && (
            <p className="text-slate-400 text-[10px] mt-0.5">{wait.sub}</p>
          )}
        </div>

        {/* Experience */}
        {doctor.experienceYears > 0 && (
          <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
            <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Experience</p>
            <p className="text-slate-800 font-bold text-xs">{doctor.experienceYears} yrs</p>
          </div>
        )}

      </div>

      {/* ── Paused/Break notices ────────────────────────────────────────────── */}
      {currentAvState === "break" && (
        <div className="mt-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-md p-3">
          <strong>Doctor on break:</strong> {doctor.temporaryNotice?.message || "Away from desk."}
          {doctor.temporaryNotice?.expectedUntil && (
            <span className="block mt-1 text-slate-500 font-medium">
              Expected return: {new Date(doctor.temporaryNotice.expectedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* ── Delayed notice ─────────────────────────────────── */}
      {currentAvState === "delayed" && (
        <div className="mt-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-md p-3">
          <strong>Delayed:</strong> The doctor's expected return time has passed. Notice: {doctor.temporaryNotice?.message || "Expected return exceeded."}
        </div>
      )}

      {/* ── Next Available slot info ────────────────────────────────────────── */}
      {!canBook && doctor.nextAvailable && (
        <div className="mt-3 bg-indigo-50 border border-indigo-100 text-indigo-850 text-xs rounded-md p-3">
          <strong>Next Available:</strong> {doctor.nextAvailable}
        </div>
      )}

      {/* ── Action row ────────────────────────────────────────────────────── */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className={`text-[11px] font-medium ${canBook ? "text-emerald-600" : "text-rose-600"}`}>
          {canBook ? "● Online" : "● Offline"}
        </span>

        <button
          onClick={() => onBook(doctorId)}
          disabled={!canBook}
          className={`
            px-4 py-2 rounded text-xs font-semibold transition
            ${canBook
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"}
          `}
        >
          {canBook ? "Book Now" : "Unavailable"}
        </button>
      </div>

    </div>
  );
}
