export default function StatCard({
  title,
  value,
  icon,
  color
}) {

  return (
    <div className={`
      rounded-xl p-5 shadow bg-white border-l-4 ${color}
    `}>

      <div className="flex justify-between items-center">

        <div>

          <p className="text-gray-500 text-sm">
            {title}
          </p>

          <h2 className="text-2xl font-bold mt-2">
            {value}
          </h2>

        </div>

        <div className="text-3xl">
          {icon}
        </div>

      </div>

    </div>
  );
}