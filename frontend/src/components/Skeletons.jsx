export function StatCardSkeleton() {
  return (
    <div className="rounded-xl p-5 shadow bg-white border-l-4 border-gray-200 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-3 flex-1">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-7 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="w-10 h-10 rounded bg-gray-200"></div>
      </div>
    </div>
  );
}

export function DoctorCardSkeleton() {
  return (
    <div className="bg-white shadow-sm rounded-xl p-5 mb-4 border border-gray-100 animate-pulse">
      {/* Top row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
          <div className="w-12 h-6 bg-gray-200 rounded-full"></div>
        </div>
      </div>

      {/* Info row */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 h-14"></div>
        <div className="bg-gray-50 rounded-lg p-3 h-14"></div>
        <div className="bg-gray-50 rounded-lg p-3 h-14"></div>
      </div>

      {/* Action row */}
      <div className="mt-4 flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-9 bg-gray-200 rounded w-24"></div>
      </div>
    </div>
  );
}
