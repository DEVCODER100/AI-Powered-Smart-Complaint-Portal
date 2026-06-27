import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireAuth, RequireAdmin } from "./lib/auth";
import Login from "./pages/Login";
import Intake from "./pages/Intake";
import MyComplaints from "./pages/MyComplaints";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Intake />
            </RequireAuth>
          }
        />
        <Route
          path="/complaints"
          element={
            <RequireAuth>
              <MyComplaints />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
