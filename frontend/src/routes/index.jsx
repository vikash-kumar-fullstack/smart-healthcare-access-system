import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// Eagerly imported Layouts and Patient pages for zero-latency instant navigation
import PublicLayout from "../layouts/PublicLayout";
import PatientLayout from "../layouts/PatientLayout";
import DoctorLayout from "../layouts/DoctorLayout";
import AdminLayout from "../layouts/AdminLayout";
import ReceptionistLayout from "../layouts/ReceptionistLayout";

import PatientDashboard from "../pages/patient/Dashboard";
import PatientSearch from "../pages/patient/Search";
import Queue from "../pages/patient/Queue";
import History from "../pages/patient/History";
import Notifications from "../pages/patient/Notifications";
import Appointments from "../pages/patient/Appointments";
import Saved from "../pages/patient/Saved";
import Profile from "../pages/patient/Profile";
import Settings from "../pages/patient/Settings";
import FamilyDashboard from "../modules/family/pages/FamilyDashboard";
import PatientVitals from "../pages/patient/Vitals";
import PatientEmergency from "../pages/patient/Emergency";

const Login = lazy(() => import("../pages/Login"));
const Signup = lazy(() => import("../pages/Signup"));
const Landing = lazy(() => import("../pages/Landing"));
const GetStarted = lazy(() => import("../pages/GetStarted"));
const DoctorRegister = lazy(() => import("../pages/DoctorRegister"));
const HospitalRegister = lazy(() => import("../pages/HospitalRegister"));
const CompleteProfile = lazy(() => import("../pages/CompleteProfile"));
const OAuthCallback = lazy(() => import("../pages/OAuthCallback"));
const OAuthSuccess = lazy(() => import("../pages/OAuthSuccess"));
const RealtimeProvider = lazy(() =>
  import("../components/RealtimeProvider").then((module) => ({
    default: module.RealtimeProvider
  }))
);

import DoctorDashboard from "../pages/doctor/Dashboard";
import Analytics from "../pages/doctor/Analytics";
import MedicalRecords from "../pages/MedicalRecords";
import RecordDetails from "../pages/RecordDetails";
import MedicalTimeline from "../pages/MedicalTimeline";

import AdminDashboard from "../pages/admin/Dashboard";
import SecurityDashboard from "../pages/admin/SecurityDashboard";
import AdminHospitals from "../pages/admin/Hospitals";
import AdminDoctors from "../pages/admin/Doctors";
import AdminQueues from "../pages/admin/Queues";
import AdminReports from "../pages/admin/Reports";
import AdminHealth from "../pages/admin/Health";
import AdminAudits from "../pages/admin/AuditLogs";
import HospitalOverview from "../pages/admin/HospitalOverview";
import Receptionists from "../pages/admin/Receptionists";
import Reception from "../pages/admin/Reception";
import AdminSchedules from "../pages/admin/Schedules";
import Applications from "../pages/admin/Applications";
import HospitalDoctors from "../pages/admin/HospitalDoctors";

const BookingJourney = lazy(() => import("../pages/patient/BookingJourney"));
const BookingSuccess = lazy(() => import("../pages/patient/BookingSuccess"));

const RouteFallback = () => (
  <div className="min-h-screen bg-[var(--color-light)] p-6">
    <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
      <div className="h-[72px] rounded-2xl bg-slate-200/70"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-24 rounded-2xl bg-slate-200/70"></div>
        <div className="h-24 rounded-2xl bg-slate-200/70"></div>
        <div className="h-24 rounded-2xl bg-slate-200/70"></div>
      </div>
      <div className="h-[60vh] rounded-3xl bg-slate-200/70"></div>
    </div>
  </div>
);

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={<PublicLayout />}
          >
            <Route index element={<Landing />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="oauth/callback" element={<OAuthCallback />} />
            <Route path="oauth/success" element={<OAuthSuccess />} />
            <Route path="get-started" element={<GetStarted />} />
            <Route path="doctor/register" element={<DoctorRegister />} />
            <Route path="hospital/register" element={<HospitalRegister />} />
          </Route>

          <Route
            path="/complete-profile"
            element={
              <ProtectedRoute role="patient">
                <CompleteProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/patient"
            element={
              <ProtectedRoute role="patient">
                <RealtimeProvider>
                  <PatientLayout />
                </RealtimeProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<PatientDashboard />} />
            <Route path="search" element={<PatientSearch />} />
            <Route path="queue" element={<Queue />} />
            <Route path="history" element={<History />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="saved" element={<Saved />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="book" element={<BookingJourney />} />
            <Route path="booking-success" element={<BookingSuccess />} />
            <Route path="family" element={<FamilyDashboard />} />
            <Route path="vitals" element={<PatientVitals />} />
            <Route path="emergency" element={<PatientEmergency />} />
            <Route path="medical-records" element={<MedicalRecords />} />
            <Route path="medical-records/:id" element={<RecordDetails />} />
            <Route path="timeline" element={<MedicalTimeline />} />
          </Route>

          <Route
            path="/doctor"
            element={
              <ProtectedRoute role="doctor">
                <RealtimeProvider>
                  <DoctorLayout />
                </RealtimeProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<DoctorDashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="medical-records" element={<MedicalRecords />} />
            <Route path="medical-records/:id" element={<RecordDetails />} />
            <Route path="timeline" element={<MedicalTimeline />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <RealtimeProvider>
                  <AdminLayout />
                </RealtimeProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="security" element={<SecurityDashboard />} />
            <Route path="hospitals" element={<AdminHospitals />} />
            <Route path="hospitals/:id" element={<HospitalDoctors />} />
            <Route path="doctors" element={<AdminDoctors />} />
            <Route path="queues" element={<AdminQueues />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="audits" element={<AdminAudits />} />
            <Route path="hospital-overview" element={<HospitalOverview />} />
            <Route path="receptionists" element={<Receptionists />} />
            <Route path="schedules" element={<AdminSchedules />} />
            <Route path="analytics" element={<HospitalOverview />} />
            <Route path="applications" element={<Applications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>

          <Route
            path="/reception"
            element={
              <ProtectedRoute role="receptionist">
                <RealtimeProvider>
                  <ReceptionistLayout />
                </RealtimeProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Reception />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
