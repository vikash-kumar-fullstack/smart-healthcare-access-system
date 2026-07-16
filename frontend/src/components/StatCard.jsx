export default function StatCard({
  title,
  value,
  icon
}) {

  return (
    <div className="rounded-lg p-5 bg-white border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            {title}
          </p>
          <h2 className="text-2xl font-bold mt-1.5 text-slate-900">
            {value}
          </h2>
        </div>
        <div className="text-slate-400 text-2xl font-medium">
          {icon}
        </div>
      </div>
    </div>
  );
}