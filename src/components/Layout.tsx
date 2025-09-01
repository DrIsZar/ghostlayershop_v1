import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Services Manager', href: '/services', icon: Package },
    { name: 'Sales & Expenses', href: '/transactions', icon: DollarSign },
    { name: 'Subscriptions', href: '/subscriptions', icon: Clock },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 safe">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-8 left-4 z-20">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 bg-gray-800/80 backdrop-blur-sm border border-gray-600/50 rounded-xl text-white hover:bg-gray-700/90 hover:border-gray-500/70 transition-all duration-200 shadow-lg shadow-black/20"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeSidebar}
        />
      )}

      {/* Desktop Layout Container */}
      <div className="lg:flex lg:min-h-screen">
        {/* Sidebar */}
        <div className={`
          fixed left-0 top-0 h-full bg-gray-800 border-r border-gray-700 z-40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:fixed lg:z-10
          w-64
        `}>
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Ghost className="h-8 w-8 text-green-500" />
              <div>
                <h1 className="text-xl font-bold text-white">GhostLayer</h1>
                <p className="text-sm text-gray-400">Shop Dashboard</p>
              </div>
            </div>
            <button
              onClick={closeSidebar}
              className="lg:hidden p-1 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <nav className="mt-6 px-3">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={closeSidebar}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all duration-200
                    ${isActive 
                      ? 'bg-green-500/20 text-green-500 border-r-2 border-green-500' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:ml-64 flex-1 flex flex-col min-h-screen">
          <main className="flex-1 p-4 lg:p-6 pt-24 lg:pt-6 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}