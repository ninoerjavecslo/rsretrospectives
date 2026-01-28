import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Analytics, TeamPerformance } from './pages/Analytics';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="team" element={<TeamPerformance />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
