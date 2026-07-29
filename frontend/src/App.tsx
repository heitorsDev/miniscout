import { Navigate, Route, Routes } from "react-router-dom";
import { AdminProfilePage } from "./pages/AdminProfilePage";

export function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminProfilePage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
