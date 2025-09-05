import { useState, useEffect } from 'react';
import { PlusIcon, MagnifyingGlassIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-white">Clients</h1>
          <p className="text-gray-400 mt-1">Manage your client relationships</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setSelectedClient(undefined);
              setIsModalOpen(true);
            }}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="h-5 w-5 inline-block -ml-1 mr-2" />
            Add Client
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              placeholder="Search clients..."
              className="block w-full rounded-md border-0 bg-white/5 py-1.5 pl-10 pr-3 text-white placeholder:text-gray-400 focus:bg-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <SearchableDropdown
            options={[
              { value: 'name', label: 'Sort by Name' },
              { value: 'total_spent', label: 'Sort by Total Spent' },
              { value: 'type', label: 'Sort by Type' }
            ]}
            value={sortBy}
            onChange={(value) => setSortBy(value as 'name' | 'total_spent' | 'type')}
            placeholder="Sort by"
            className="rounded-md border-0 bg-white/5 py-1.5 pl-3 pr-8 text-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
            showSearchThreshold={10}
          />
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="rounded-md bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      {!loading && !error && clients.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white/5 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">👥</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">Total Clients</dt>
                    <dd className="text-lg font-medium text-white">{clients.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">🔄</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">Resellers</dt>
                    <dd className="text-lg font-medium text-white">
                      {clients.filter(c => c.type === 'reseller').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">💰</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">Total Revenue</dt>
                    <dd className="text-lg font-medium text-white">
                      ${clients.reduce((sum, c) => sum + (c.total_spent || 0), 0).toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">📊</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">Avg. per Client</dt>
                    <dd className="text-lg font-medium text-white">
                      ${clients.length > 0 ? (clients.reduce((sum, c) => sum + (c.total_spent || 0), 0) / clients.length).toFixed(2) : '0.00'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 rounded-md bg-red-900/20 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-400">Error</h3>
              <div className="mt-2 text-sm text-red-300">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={loadClients}
                  className="rounded-md bg-red-900/50 px-2 py-1.5 text-sm font-medium text-red-300 hover:bg-red-900/75 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-900"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-0">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">
                    Contact
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">
                    Source
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">
                    Total Spent
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">
                    Services Bought
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mr-3"></div>
                        Loading clients...
                      </div>
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      {searchTerm ? (
                        <div>
                          <p>No clients found matching "{searchTerm}"</p>
                          <button
                            onClick={() => setSearchTerm('')}
                            className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : clients.length === 0 ? (
                        <div>
                          <p>No clients found. Add your first client to get started.</p>
                          <button
                            onClick={() => {
                              setSelectedClient(undefined);
                              setIsModalOpen(true);
                            }}
                            className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm"
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
                    <tr key={client.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-0">
                        {client.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          client.type === 'reseller' 
                            ? 'bg-purple-400/10 text-purple-400 ring-1 ring-inset ring-purple-400/20' 
                            : 'bg-blue-400/10 text-blue-400 ring-1 ring-inset ring-blue-400/20'
                        }`}>
                          {client.type === 'reseller' ? 'Reseller' : 'Client'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                        {client.email && <div>{client.email}</div>}
                        {client.telegram && <div className="text-blue-400">{client.telegram}</div>}
                        {client.discord && <div className="text-indigo-400">{client.discord}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                        {client.source || '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                        ${client.total_spent?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-300">
                        <div className="max-w-xs overflow-hidden">
                          {client.services_bought?.join(', ') || 'None'}
                        </div>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <div className="flex justify-end gap-4">
                          <button
                            onClick={() => {
                              setSelectedClient(client);
                              setIsModalOpen(true);
                            }}
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client)}
                            className="text-red-500 hover:text-red-400"
                          >
                            Delete
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