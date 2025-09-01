import React from 'react';
import { Settings as SettingsIcon, Database, Shield, Bell } from 'lucide-react';

export default function Settings() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your dashboard preferences</p>
      </div>

      <div className="ghost-card p-8 text-center">
        <SettingsIcon className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Settings Panel Coming Soon</h2>
        <p className="text-gray-400 mb-6">
          We're working on a comprehensive settings panel where you can customize your 
          dashboard experience, manage data, and configure preferences.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="p-4 bg-gray-700 rounded-lg">
            <Database className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <h3 className="font-semibold text-white">Data Management</h3>
            <p className="text-sm text-gray-400">Import/export your data</p>
          </div>
          <div className="p-4 bg-gray-700 rounded-lg">
            <Shield className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h3 className="font-semibold text-white">Security</h3>
            <p className="text-sm text-gray-400">Manage account security</p>
          </div>
          <div className="p-4 bg-gray-700 rounded-lg">
            <Bell className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <h3 className="font-semibold text-white">Notifications</h3>
            <p className="text-sm text-gray-400">Configure alert preferences</p>
          </div>
        </div>
      </div>
    </div>
  );
}