import React from "react";
import { Outlet } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";

export default function DoctorLayout() {
  return (
    <DashboardLayout role="doctor">
      <Outlet />
    </DashboardLayout>
  );
}
