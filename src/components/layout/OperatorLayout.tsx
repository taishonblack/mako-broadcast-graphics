import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PlusCircle, Settings, FolderOpen, Grid3x3, Image as ImageIcon, BarChart3 } from 'lucide-react';

const navItems = [
  { icon: FolderOpen, label: 'Projects', path: '/projects' },
  { icon: PlusCircle, label: 'Workspace', path: '/workspace' },
  { icon: Grid3x3, label: 'Blocks', path: '/blocks' },
  { icon: ImageIcon, label: 'Background Gallery', path: '/backgrounds' },
  { icon: BarChart3, label: 'Statistics', path: '/statistics' },
];

export function OperatorLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-4 gap-1 bg-sidebar border-r border-sidebar-border shrink-0">
        {/* Logo */}
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center mb-4">
          <span className="text-primary-foreground font-bold text-sm">M</span>
        </div>

        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path.split('/').slice(0, 2).join('/'));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-primary'
                  : 'text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent'
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          );
        })}

        <div className="mt-auto">
          <Link
            to="/settings"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              location.pathname.startsWith('/settings')
                ? 'bg-sidebar-accent text-primary'
                : 'text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent'
            }`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {children}
      </main>
    </div>
  );
}
