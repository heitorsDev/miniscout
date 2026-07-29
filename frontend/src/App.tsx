import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { AdminProfilePage } from "./pages/AdminProfilePage";
import { AdminCompetitionsPage } from "./pages/AdminCompetitionsPage";
import { AdminCompetitionDetailPage } from "./pages/AdminCompetitionDetailPage";
import { ScouterPage } from "./pages/ScouterPage";

export function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminProfilePage />} />
        <Route path="/admin/competitions" element={<AdminCompetitionsPage />} />
        <Route path="/admin/competitions/:id" element={<AdminCompetitionDetailPage />} />
      </Route>
      <Route path="/scout" element={<ScouterPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}