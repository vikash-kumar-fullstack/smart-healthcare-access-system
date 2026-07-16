import React from "react";

export default function Input({
  type = "text",
  placeholder = "",
  value,
  onChange,
  icon: Icon,
  className = "",
  id,
}) {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      {Icon && (
        <div className="absolute left-4 text-slate-400 pointer-events-none">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full h-12 bg-transparent text-slate-800 placeholder-slate-400 text-sm focus:outline-none ${
          Icon ? "pl-11" : "pl-4"
        } pr-4 rounded-xl border border-transparent transition-all`}
      />
    </div>
  );
}
