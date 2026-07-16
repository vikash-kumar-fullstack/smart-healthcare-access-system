import React from "react";

export default function Skeleton({ className = "", variant = "rect" }) {
  const baseClasses = "bg-slate-200 animate-pulse";
  const variantClasses = {
    circle: "rounded-full",
    rect: "rounded-xl",
    text: "rounded-md h-4 w-full"
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.rect} ${className}`}
      style={{
        animationDuration: "var(--transition-slow)"
      }}
    />
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-[50vh]" />
    </div>
  );
}
