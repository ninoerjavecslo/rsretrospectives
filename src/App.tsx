import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Analytics, TeamPerformance } from './pages/Analytics';
import { AIAssistant } from './pages/AIAssistant';
import { Estimator } from './pages/Estimator';
import { EditProvider } from './context/EditContext';

export default function App() {
  return (
    <EditProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="team" element={<TeamPerformance />} />
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="estimator" element={<Estimator />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </EditProvider>
  );
}
