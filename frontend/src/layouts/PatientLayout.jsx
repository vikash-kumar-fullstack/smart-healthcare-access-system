import React from "react";
import { Outlet } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";

export default function PatientLayout() {
  return (
    <DashboardLayout role="patient">
      <Outlet />
    </DashboardLayout>
  );
}
