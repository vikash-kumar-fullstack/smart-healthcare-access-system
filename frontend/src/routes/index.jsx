import { BrowserRouter, Routes, Route ,Navigate} from "react-router-dom";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import ProtectedRoute from "./ProtectedRoute";
import PatientLayout from "../layouts/PatientLayout";
import Dashboard from "../pages/patient/Dashboard";
import PatientSearch from "../pages/patient/Search";
import Queue from "../pages/patient/Queue";
import History from "../pages/patient/History";
import Notifications from "../pages/patient/Notifications";
import DoctorLayout from "../layouts/DoctorLayout";
import DoctorDashboard from "../pages/doctor/Dashboard";
import Analytics from "../pages/doctor/Analytics";
import MedicalRecords from "../pages/MedicalRecords";
import RecordDetails from "../pages/RecordDetails";
import MedicalTimeline from "../pages/MedicalTimeline";
import AdminLayout from "../layouts/AdminLayout";
import AdminDashboard from "../pages/admin/Dashboard";
import AdminHospitals from "../pages/admin/Hospitals";
import AdminDoctors from "../pages/admin/Doctors";
import AdminQueues from "../pages/admin/Queues";
import AdminReports from "../pages/admin/Reports";
import AdminHealth from "../pages/admin/Health";
import AdminAudits from "../pages/admin/AuditLogs";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* Patient */}
        <Route
            path="/patient"
            element={
              <ProtectedRoute role="patient">
                <PatientLayout />
              </ProtectedRoute>
            }
          >
          <Route index element={<Dashboard />} />
          <Route
            path="search"
            element={<PatientSearch />}
          />
          <Route
            path="queue"
            element={<Queue />}
          />
          <Route
            path="history"
            element={<History />}
          />  
          <Route
            path="notifications"
            element={<Notifications />}
          />
          <Route
            path="medical-records"
            element={<MedicalRecords />}
          />
          <Route
            path="medical-records/:id"
            element={<RecordDetails />}
          />
          <Route
            path="timeline"
            element={<MedicalTimeline />}
          />
          
        </Route>
        <Route
        path="/doctor"
        element={
          <ProtectedRoute role="doctor">
            <DoctorLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={<DoctorDashboard />}
        />
        <Route
          path="analytics"
          element={<Analytics />}
        />
        <Route
          path="medical-records"
          element={<MedicalRecords />}
        />
        <Route
          path="medical-records/:id"
          element={<RecordDetails />}
        />
        <Route
          path="timeline"
          element={<MedicalTimeline />}
        />
      </Route>
        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="hospitals" element={<AdminHospitals />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="queues" element={<AdminQueues />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="health" element={<AdminHealth />} />
          <Route path="audits" element={<AdminAudits />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}