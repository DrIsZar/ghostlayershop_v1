import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  DollarSign,
  BarChart3,
  Users,
  Settings,
  Menu,
  X,
  Clock,
  Archive,
  TrendingUp
} from 'lucide-react';
import CurrencyToggle from './CurrencyToggle';
import { Button } from '@/components/ui/button';

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Hide currency toggle on subscriptions page (no currency values displayed)
  const showCurrencyToggle = location.pathname !== '/subscriptions';

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
    { name: 'Cash Flow', href: '/cashflow', icon: TrendingUp },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Menu Button */}
      <Button
        onClick={() => setSidebarOpen(true)}
        variant="secondary"
        size="icon"
        className="lg:hidden fixed z-50 min-h-[44px] min-w-[44px]"
        style={{
          top: `calc(1rem + env(safe-area-inset-top) + 0.5rem)`,
          left: `calc(1rem + env(safe-area-inset-left))`
        }}
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full w-64 max-w-[85vw] bg-card border-r border-border z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:h-screen lg:min-h-screen
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border" style={{
          paddingTop: `calc(1rem + env(safe-area-inset-top) + 0.5rem)`,
          minHeight: 'calc(80px + env(safe-area-inset-top) + 0.5rem)'
        }}>
          <div className="flex items-center gap-3">
            <img src="/upgrade-tn-logo.png" alt="Upgrade TN" className="h-10 w-10 flex-shrink-0 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Upgrade TN</h1>
              <p className="text-xs text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSidebar}
            className="lg:hidden min-h-[44px] min-w-[44px]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Currency Toggle in Sidebar (Mobile) */}
        {/* Currency Toggle in Sidebar (Mobile) */}
        {showCurrencyToggle && (
          <div className="px-3 py-3 border-b border-border lg:hidden">
            <CurrencyToggle />
          </div>
        )}

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
                    ? 'bg-primary/10 text-foreground border-l-2 border-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
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
      <div className="flex-1 min-h-screen bg-black lg:ml-64">
        <main className="h-full p-4 lg:p-6 relative" style={{
          paddingTop: `calc(80px + env(safe-area-inset-top) + 0.5rem)`,
          paddingBottom: `calc(1rem + env(safe-area-inset-bottom))`,
          paddingLeft: `calc(1rem + env(safe-area-inset-left))`,
          paddingRight: `calc(1rem + env(safe-area-inset-right))`
        }}>
          {/* Currency Toggle - Desktop Header (Absolute Position, scrolls with content) */}
          {showCurrencyToggle && (
            <div
              className="hidden lg:flex absolute z-50"
              style={{
                top: '1rem',
                right: '1rem'
              }}
            >
              <CurrencyToggle />
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Toast Container */}
      <div id="toast-container" />
    </div>
  );
}