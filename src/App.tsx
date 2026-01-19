import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { CurrencyProvider } from './lib/currency';

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ServicesManager = lazy(() => import('./pages/ServicesManager'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Reports = lazy(() => import('./pages/Reports'));
const CashFlow = lazy(() => import('./pages/CashFlow'));
const Clients = lazy(() => import('./pages/Clients'));
const Settings = lazy(() => import('./pages/Settings'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-black">
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-6">
        <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-gray-400 text-base font-medium">Loading dashboard...</p>
      <p className="text-gray-600 text-sm mt-2">Upgrade TN</p>
    </div>
  </div>
);

function App() {
  return (
    <CurrencyProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route
              index
              element={
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path="services"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ServicesManager />
                </Suspense>
              }
            />
            <Route
              path="transactions"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Transactions />
                </Suspense>
              }
            />
            <Route
              path="subscriptions"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Subscriptions />
                </Suspense>
              }
            />
            <Route
              path="inventory"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Inventory />
                </Suspense>
              }
            />
            <Route
              path="reports"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Reports />
                </Suspense>
              }
            />
            <Route
              path="cashflow"
              element={
                <Suspense fallback={<PageLoader />}>
                  <CashFlow />
                </Suspense>
              }
            />
            <Route
              path="clients"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Clients />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Settings />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </Router>
    </CurrencyProvider>
  );
}

export default App;