import React from "react";

export default function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  type = "button",
  disabled = false,
}) {
  const baseStyle =
    "inline-flex items-center justify-center font-semibold text-sm transition-all duration-300 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[#0E7490] hover:bg-[#0b5c72] text-white border border-[#0E7490] hover:shadow-md hover:shadow-cyan-900/10",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300",
    outline: "border border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-50 shadow-none border-transparent",
    accent: "bg-[#14B8A6] hover:bg-[#0f8b7d] text-white border border-[#14B8A6] hover:shadow-md hover:shadow-teal-900/10",
  };

  const buttonStyle = `${baseStyle} ${variants[variant]} h-12 px-6 rounded-2xl ${className}`;

  return (
    <button
      type={type}
      className={buttonStyle}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
