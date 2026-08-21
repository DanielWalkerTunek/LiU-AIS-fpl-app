import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import StandingsPage from './pages/StandingsPage';
import PlayersPage from './pages/PlayersPage';
import TransfersPage from './pages/TransfersPage';
import MyTeamPage from './pages/MyTeamPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="standings" element={<StandingsPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="my-team" element={<MyTeamPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}
