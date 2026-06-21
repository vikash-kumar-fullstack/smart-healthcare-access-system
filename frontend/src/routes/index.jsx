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
      </Routes>
    </BrowserRouter>
  );
}