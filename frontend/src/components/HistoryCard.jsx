import { CalendarDays, CheckCircle2, CircleSlash, FileText, TriangleAlert } from "lucide-react";

export default function HistoryCard({ item, onViewSummary }) {
  const statusMap = {
    completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: CircleSlash },
    skipped: { label: "Skipped", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: TriangleAlert },
    unavailable: { label: "Unavailable", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: CircleSlash }
  };

  const statusCfg = statusMap[item.status] || {
    label: item.status,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    icon: CircleSlash
  };
  const Icon = statusCfg.icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-primary)]">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{item.doctorName}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.specialization}</p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCfg.cls}`}>
          <Icon className="h-3.5 w-3.5" />
          {statusCfg.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Queue Number</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{item.queueNumber}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Booked</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{new Date(item.bookedAt).toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">State</p>
          <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{item.status}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        {item.completedAt && (
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-emerald-500" />
            <span>Completed {new Date(item.completedAt).toLocaleString()}</span>
          </p>
        )}

        {item.cancelledAt && (
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-rose-500" />
            <span>Cancelled {new Date(item.cancelledAt).toLocaleString()}</span>
          </p>
        )}
      </div>

      {item.visitId && item.status === "completed" && (
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <button
            onClick={() => onViewSummary(item.visitId)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
          >
            <FileText className="h-3.5 w-3.5" />
            View Medical Summary
          </button>
        </div>
      )}
    </div>
  );
}
