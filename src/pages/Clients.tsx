import { useState, useEffect } from 'react';
import { Plus, Search, AlertTriangle, Users, TrendingUp, DollarSign, Calendar, Edit, Trash2, Eye } from 'lucide-react';
import { clientsDb } from '../lib/clients';
import { supabase } from '../lib/supabase';
import type { Client, ClientStatistics } from '../types/client';
import ClientModal from '../components/ClientModal';
import SearchableDropdown from '../components/SearchableDropdown';

export default function Clients() {
  const [clients, setClients] = useState<(Client & Partial<ClientStatistics>)[]>([]);
  const [filteredClients, setFilteredClients] = useState<(Client & Partial<ClientStatistics>)[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | undefined>();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'total_spent' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  // Filter and sort clients when search term, sort options, or clients change
  useEffect(() => {
    let filtered = clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.telegram?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.discord?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.source?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort clients
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'total_spent':
          aValue = a.total_spent || 0;
          bValue = b.total_spent || 0;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredClients(filtered);
  }, [clients, searchTerm, sortBy, sortOrder]);

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);
      const clientList = await clientsDb.getAll();
      const clientsWithStats = await Promise.all(
        clientList.map(async (client) => {
          try {
            const stats = await clientsDb.getStatistics(client.id);
            return { ...client, ...stats };
          } catch (statsError) {
            console.error(`Error loading stats for client ${client.name}:`, statsError);
            // Return client with default stats if statistics fail
            return {
              ...client,
              total_purchases: 0,
              total_spent: 0,
              services_bought: []
            };
          }
        })
      );
      setClients(clientsWithStats);
    } catch (error) {
      console.error('Error loading clients:', error);
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveClient(clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) {
    try {
      if (selectedClient) {
        await clientsDb.update(selectedClient.id, clientData);
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert([{
            ...clientData,
            type: clientData.type || 'client', // Ensure type is always set
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) {
          console.error('Supabase error:', error);
          throw new Error(error.message);
        }
        
        if (!data) {
          throw new Error('No data returned from client creation');
        }
      }
      await loadClients();
      setIsModalOpen(false);
      setSelectedClient(undefined);
    } catch (error: any) {
      console.error('Error saving client:', error);
      throw new Error(error.message || 'Failed to save client');
    }
  }

  async function handleDeleteClient(client: Client) {
    if (!confirm(`Warning: Deleting ${client.type === 'reseller' ? 'reseller' : 'client'} "${client.name}" will also delete all their transaction history. Are you sure?`)) {
      return;
    }

    try {
      // First delete all transactions for this client
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('client_id', client.id);

      if (transactionsError) throw transactionsError;

      // Then delete the client
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (clientError) throw clientError;

      await loadClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      const errorMessage = error.code === '23503'
        ? `Cannot delete this ${client.type}. Please delete all related transactions first.`
        : `Failed to delete ${client.type}. Please try again.`;
      alert(errorMessage);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Clients</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">Manage your client relationships and track their activity</p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => {
              setSelectedClient(undefined);
              setIsModalOpen(true);
            }}
            className="ghost-button flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start px-4 py-2.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Add Client</span>
            <span className="xs:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[300px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
              <input
                type="text"
                placeholder="Search by name, email, telegram, discord, or source..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <SearchableDropdown
              label="Sort by"
              options={[
                { value: 'name', label: 'Name' },
                { value: 'total_spent', label: 'Total Spent' },
                { value: 'type', label: 'Type' }
              ]}
              value={sortBy}
              onChange={(value) => setSortBy(value as 'name' | 'total_spent' | 'type')}
              placeholder="Sort by"
              className="min-w-[140px]"
              showSearchThreshold={3}
            />
          </div>

          {/* Sort Order Button */}
          <div className="flex items-end">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Clients</p>
              <p className="text-2xl font-bold text-white">{clients.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Resellers</p>
              <p className="text-2xl font-bold text-white">
                {clients.filter(c => c.type === 'reseller').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-white">
                ${clients.reduce((sum, c) => sum + (c.total_spent || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Avg. per Client</p>
              <p className="text-2xl font-bold text-white">
                ${clients.length > 0 ? (clients.reduce((sum, c) => sum + (c.total_spent || 0), 0) / clients.length).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-2xl p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-400">Error</h3>
              <div className="mt-2 text-sm text-red-300">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={loadClients}
                  className="ghost-button-secondary px-3 py-2 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-700/50 relative z-10">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Name</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Type</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Contact</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Source</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Total Spent</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Services Bought</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mr-3"></div>
                      Loading clients...
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    {searchTerm ? (
                      <div>
                        <p className="text-lg mb-2">No clients found matching "{searchTerm}"</p>
                        <button
                          onClick={() => setSearchTerm('')}
                          className="ghost-button-secondary mt-2"
                        >
                          Clear search
                        </button>
                      </div>
                    ) : clients.length === 0 ? (
                      <div>
                        <p className="text-lg mb-2">No clients found. Add your first client to get started.</p>
                        <button
                          onClick={() => {
                            setSelectedClient(undefined);
                            setIsModalOpen(true);
                          }}
                          className="ghost-button mt-2"
                        >
                          Add your first client
                        </button>
                      </div>
                    ) : (
                      'No clients match your search criteria.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 md:px-6 py-4 text-white font-medium">
                      <div className="text-sm md:text-base font-semibold">
                        {client.name}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        client.type === 'reseller' 
                          ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30' 
                          : 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                      }`}>
                        {client.type === 'reseller' ? 'Reseller' : 'Client'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm">
                      <div className="space-y-1">
                        {client.email && <div className="text-white">{client.email}</div>}
                        {client.telegram && <div className="text-blue-400">@{client.telegram}</div>}
                        {client.discord && <div className="text-indigo-400">@{client.discord}</div>}
                        {!client.email && !client.telegram && !client.discord && (
                          <span className="text-gray-500">No contact info</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm">
                      {client.source || '-'}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-white text-sm font-medium">
                      ${client.total_spent?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm">
                      <div className="max-w-xs">
                        {client.services_bought && client.services_bought.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {client.services_bought.slice(0, 2).map((service, index) => (
                              <span key={index} className="inline-block bg-gray-700/50 text-gray-300 px-2 py-1 rounded text-xs">
                                {service}
                              </span>
                            ))}
                            {client.services_bought.length > 2 && (
                              <span className="inline-block bg-gray-700/50 text-gray-400 px-2 py-1 rounded text-xs">
                                +{client.services_bought.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex gap-1 md:gap-2">
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setIsModalOpen(true);
                          }}
                          className="p-1 md:p-2 text-gray-400 hover:text-green-500 transition-colors rounded"
                          title="Edit client"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client)}
                          className="p-1 md:p-2 text-gray-400 hover:text-red-500 transition-colors rounded"
                          title="Delete client"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClientModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedClient(undefined);
        }}
        onSave={handleSaveClient}
        initialData={selectedClient}
      />
    </div>
  );
}