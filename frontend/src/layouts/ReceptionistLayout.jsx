import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";

const LayoutFallback = () => (
  <div className="py-12 text-center animate-pulse">
    <div className="h-8 w-48 bg-slate-200/80 rounded-xl mx-auto mb-4" />
    <div className="h-64 w-full bg-slate-200/60 rounded-3xl" />
  </div>
);

export default function ReceptionistLayout() {
  return (
    <DashboardLayout role="receptionist">
      <Suspense fallback={<LayoutFallback />}>
        <Outlet />
      </Suspense>
    </DashboardLayout>
  );
}
