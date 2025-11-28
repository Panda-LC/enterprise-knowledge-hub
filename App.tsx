
import React, { useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate, Link } from 'react-router-dom';
import { Library, Share2, Workflow, Settings as SettingsIcon, LogOut, Menu, Layers, LayoutDashboard } from 'lucide-react';
import { AssetsLibrary } from './components/AssetsLibrary';
import { ChannelConnectors } from './components/ChannelConnectors';
import { AutomationScheduler } from './components/AutomationScheduler';
import { DocumentDetail } from './components/DocumentDetail';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider, useLanguage } from './i18n';
import { FileSystemProvider } from './contexts/FileSystemContext';
import { YuqueConfigProvider } from './contexts/YuqueConfigContext';
import { ExportTaskProvider } from './contexts/ExportTaskContext';

// --- Sidebar Component ---
const Sidebar = ({ mobileOpen, setMobileOpen }: { mobileOpen: boolean, setMobileOpen: (o: boolean) => void }) => {
  const location = useLocation();
  const { t } = useLanguage();
  
  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/documents', label: t('nav.assets'), icon: Library },
    { path: '/channels', label: t('nav.channels'), icon: Share2 },
    { path: '/automation', label: t('nav.automation'), icon: Workflow },
    { path: '/settings', label: t('nav.settings'), icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-primary-900/20">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">EKH <span className="text-slate-500 font-normal">Hub</span></span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <NavLink 
                key={item.path} 
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all ${
                  isActive 
                    ? 'bg-primary-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile / Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <Link to="/settings" className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-md transition-colors group">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-900 group-hover:ring-slate-700 transition-all">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate group-hover:text-primary-300 transition-colors">John Doe</p>
              <p className="text-xs text-slate-500 truncate">{t('nav.user_settings')}</p>
            </div>
            <button className="text-slate-500 hover:text-white transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </aside>
    </>
  );
};

const MainLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLanguage();

  return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile Header */}
          <div className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 shrink-0">
            <button onClick={() => setMobileMenuOpen(true)} className="mr-4 text-slate-500">
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-bold text-slate-900">{t('nav.mobile_header')}</span>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-4 lg:p-8">
            <div className="max-w-7xl mx-auto h-full">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/documents" element={<AssetsLibrary />} />
                  <Route path="/documents/:id" element={<DocumentDetail />} />
                  <Route path="/channels" element={<ChannelConnectors />} />
                  <Route path="/automation" element={<AutomationScheduler />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
  );
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <LanguageProvider>
          <YuqueConfigProvider>
            <FileSystemProvider>
              <ExportTaskProvider>
                <MainLayout />
              </ExportTaskProvider>
            </FileSystemProvider>
          </YuqueConfigProvider>
        </LanguageProvider>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
