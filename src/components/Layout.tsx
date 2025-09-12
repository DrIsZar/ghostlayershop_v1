import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  DollarSign, 
  BarChart3, 
  Users, 
  Settings,
  Ghost,
  Menu,
  X,
  Clock,
  Archive
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);
  
  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Services Manager', href: '/services', icon: Package },
    { name: 'Sales & Expenses', href: '/transactions', icon: DollarSign },
    { name: 'Subscriptions', href: '/subscriptions', icon: Clock },
    { name: 'Inventory', href: '/inventory', icon: Archive },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed z-50 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white hover:bg-gray-700 transition-colors shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
        style={{ 
          top: `calc(1rem + env(safe-area-inset-top) + 0.5rem)`, 
          left: `calc(1rem + env(safe-area-inset-left))` 
        }}
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full w-64 max-w-[85vw] bg-gray-800 border-r border-gray-700 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:h-screen lg:min-h-screen
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700" style={{
          paddingTop: `calc(1rem + env(safe-area-inset-top) + 0.5rem)`,
          minHeight: 'calc(80px + env(safe-area-inset-top) + 0.5rem)'
        }}>
          <div className="flex items-center gap-3">
            <Ghost className="h-8 w-8 text-green-500 flex-shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-white">GhostLayer</h1>
              <p className="text-xs text-gray-400">Shop Dashboard</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-2 text-gray-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="px-3 pb-4 overflow-y-auto" style={{
          height: 'calc(100vh - 80px - env(safe-area-inset-top) - 0.5rem)',
          paddingTop: '1rem'
        }}>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-colors
                  ${isActive 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-screen bg-gray-900 lg:ml-64">
        <main className="h-full p-4 lg:p-6" style={{
          paddingTop: `calc(80px + env(safe-area-inset-top) + 0.5rem)`,
          paddingBottom: `calc(1rem + env(safe-area-inset-bottom))`,
          paddingLeft: `calc(1rem + env(safe-area-inset-left))`,
          paddingRight: `calc(1rem + env(safe-area-inset-right))`
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}