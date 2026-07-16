import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

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
const PublicLayout = lazy(() => import("../layouts/PublicLayout"));
const PatientLayout = lazy(() => import("../layouts/PatientLayout"));
const PatientDashboard = lazy(() => import("../pages/patient/Dashboard"));
const PatientSearch = lazy(() => import("../pages/patient/Search"));
const Queue = lazy(() => import("../pages/patient/Queue"));
const History = lazy(() => import("../pages/patient/History"));
const Notifications = lazy(() => import("../pages/patient/Notifications"));
const Appointments = lazy(() => import("../pages/patient/Appointments"));
const Saved = lazy(() => import("../pages/patient/Saved"));
const Profile = lazy(() => import("../pages/patient/Profile"));
const Settings = lazy(() => import("../pages/patient/Settings"));
const BookingJourney = lazy(() => import("../pages/patient/BookingJourney"));
const BookingSuccess = lazy(() => import("../pages/patient/BookingSuccess"));
const DoctorLayout = lazy(() => import("../layouts/DoctorLayout"));
const DoctorDashboard = lazy(() => import("../pages/doctor/Dashboard"));
const Analytics = lazy(() => import("../pages/doctor/Analytics"));
const MedicalRecords = lazy(() => import("../pages/MedicalRecords"));
const RecordDetails = lazy(() => import("../pages/RecordDetails"));
const MedicalTimeline = lazy(() => import("../pages/MedicalTimeline"));
const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const SecurityDashboard = lazy(() => import("../pages/admin/SecurityDashboard"));
const AdminHospitals = lazy(() => import("../pages/admin/Hospitals"));
const AdminDoctors = lazy(() => import("../pages/admin/Doctors"));
const AdminQueues = lazy(() => import("../pages/admin/Queues"));
const AdminReports = lazy(() => import("../pages/admin/Reports"));
const AdminHealth = lazy(() => import("../pages/admin/Health"));
const AdminAudits = lazy(() => import("../pages/admin/AuditLogs"));
const HospitalOverview = lazy(() => import("../pages/admin/HospitalOverview"));
const Receptionists = lazy(() => import("../pages/admin/Receptionists"));
const Reception = lazy(() => import("../pages/admin/Reception"));
const ReceptionistLayout = lazy(() => import("../layouts/ReceptionistLayout"));
const AdminSchedules = lazy(() => import("../pages/admin/Schedules"));

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
            <Route path="doctors" element={<AdminDoctors />} />
            <Route path="queues" element={<AdminQueues />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="audits" element={<AdminAudits />} />
            <Route path="hospital-overview" element={<HospitalOverview />} />
            <Route path="receptionists" element={<Receptionists />} />
            <Route path="schedules" element={<AdminSchedules />} />
            <Route path="analytics" element={<HospitalOverview />} />
            <Route path="applications" element={<AdminDoctors />} />
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
