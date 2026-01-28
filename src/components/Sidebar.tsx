import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, BarChart3, Users, MessageSquare, Calculator, Lock, Unlock } from 'lucide-react';
import { useEdit } from '../context/EditContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/team', icon: Users, label: 'Team Performance' },
  { to: '/ai-assistant', icon: MessageSquare, label: 'AI Assistant' },
  { to: '/estimator', icon: Calculator, label: 'Estimator' },
];

export function Sidebar() {
  const { canEdit, unlock, lock } = useEdit();
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  function handleUnlock() {
    if (unlock(password)) {
      setShowPasswordInput(false);
      setPassword('');
      setError(false);
    } else {
      setError(true);
    }
  }

  return (
    <div className="w-60 bg-slate-900 min-h-screen flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800">
        <div className="text-lg font-bold text-white tracking-tight">RENDERSPACE</div>
        <div className="text-xs text-slate-500 mt-0.5">Project Intelligence</div>
      </div>

      {/* Navigation */}
      <nav className="p-3 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium mb-1 transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`
            }
          >
            <item.icon className="w-5 h-5 opacity-70" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800">
        {showPasswordInput ? (
          <div className="px-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Enter password..."
              className={`w-full px-3 py-2 text-sm bg-slate-800 border rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                error ? 'border-red-500' : 'border-slate-700'
              }`}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleUnlock}
                className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Unlock
              </button>
              <button
                onClick={() => { setShowPasswordInput(false); setPassword(''); setError(false); }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => canEdit ? lock() : setShowPasswordInput(true)}
            className={`flex items-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              canEdit
                ? 'text-emerald-400 hover:bg-slate-800/50'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            {canEdit ? (
              <>
                <Unlock className="w-4 h-4" />
                Edit Mode On
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                View Only
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
