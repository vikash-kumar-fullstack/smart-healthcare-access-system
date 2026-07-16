import { BadgeCheck, BellRing, TriangleAlert } from "lucide-react";

export default function NotificationCard({ notification }) {
  const categoryMap = {
    queue: { label: "Queue Alert", cls: "bg-rose-50 text-rose-700 border-rose-200/60", icon: TriangleAlert },
    report: { label: "Diagnostic Report", cls: "bg-amber-50 text-amber-700 border-amber-200/60", icon: TriangleAlert },
    booking: { label: "Booking Update", cls: "bg-emerald-50 text-emerald-700 border-emerald-200/60", icon: BadgeCheck }
  };

  const categoryCfg = categoryMap[notification.category] || {
    label: "Update",
    cls: "bg-slate-50 text-slate-700 border-slate-200/60",
    icon: BellRing
  };
  const Icon = categoryCfg.icon;

  const isRead = notification.status === "read" || notification.isRead;
  const formattedDate = notification.createdAt 
    ? new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " · " + new Date(notification.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : "Just now";

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 ${
        isRead 
          ? "border-slate-100 bg-white/60 hover:bg-white" 
          : "border-[#14B8A6]/20 bg-gradient-to-r from-[#14B8A6]/5 to-[#14B8A6]/0 hover:from-[#14B8A6]/8 shadow-[0_4px_20px_rgba(20,184,166,0.03)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${categoryCfg.cls}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-800 leading-snug">{notification.title}</h4>
              {!isRead && (
                <span className="inline-flex items-center rounded-full bg-[#14B8A6]/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#14B8A6]">
                  New
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed font-medium text-slate-600">
              {notification.body || notification.message}
            </p>
          </div>
        </div>

        <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${categoryCfg.cls}`}>
          {categoryCfg.label}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100/80 pt-3.5 text-xs font-semibold text-slate-450">
        <span>{formattedDate}</span>
        <span>{isRead ? "Read" : "Unread"}</span>
      </div>
    </div>
  );
}
