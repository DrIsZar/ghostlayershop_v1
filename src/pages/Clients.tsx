import { useState, useEffect } from 'react';
import { Plus, Search, AlertTriangle, Users, TrendingUp, DollarSign, Calendar, Edit, Trash2 } from 'lucide-react';
import { clientsDb } from '../lib/clients';
import { supabase } from '../lib/supabase';
import type { Client, ClientStatistics } from '../types/client';
import ClientModal from '../components/ClientModal';
import SearchableDropdown from '../components/SearchableDropdown';
import { useCurrency } from '../lib/currency';

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Clients() {
  const { formatCurrency } = useCurrency();
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your client relationships and track their activity</p>
        </div>
        <div className="flex-shrink-0">
          <Button
            onClick={() => {
              setSelectedClient(undefined);
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Add Client</span>
            <span className="xs:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[300px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <Input
                  type="text"
                  placeholder="Search by name, email, telegram, discord, or source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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
              <Button
                variant="ghost"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-9"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Clients</p>
                <p className="text-2xl font-bold text-foreground">{clients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Resellers</p>
                <p className="text-2xl font-bold text-foreground">
                  {clients.filter(c => c.type === 'reseller').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(clients.reduce((sum, c) => sum + (c.total_spent || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Avg. per Client</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(clients.length > 0 ? (clients.reduce((sum, c) => sum + (c.total_spent || 0), 0) / clients.length) : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-800/50 bg-red-900/20">
          <CardContent className="p-4">
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
                  <Button variant="secondary" size="sm" onClick={loadClients}>
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Services Bought</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground mr-3"></div>
                      Loading clients...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {searchTerm ? (
                      <div>
                        <p className="text-lg mb-2">No clients found matching "{searchTerm}"</p>
                        <Button variant="secondary" onClick={() => setSearchTerm('')} className="mt-2">
                          Clear search
                        </Button>
                      </div>
                    ) : clients.length === 0 ? (
                      <div>
                        <p className="text-lg mb-2">No clients found. Add your first client to get started.</p>
                        <Button
                          onClick={() => {
                            setSelectedClient(undefined);
                            setIsModalOpen(true);
                          }}
                          className="mt-2"
                        >
                          Add your first client
                        </Button>
                      </div>
                    ) : (
                      'No clients match your search criteria.'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-secondary/50 transition-colors">
                    <TableCell className="font-semibold text-foreground">
                      {client.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.type === 'reseller' ? 'secondary' : 'outline'}>
                        {client.type === 'reseller' ? 'Reseller' : 'Client'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="space-y-1">
                        {client.email && <div className="text-foreground">{client.email}</div>}
                        {client.telegram && <div className="text-foreground">@{client.telegram}</div>}
                        {client.discord && <div className="text-foreground">@{client.discord}</div>}
                        {!client.email && !client.telegram && !client.discord && (
                          <span className="text-muted-foreground/50">No contact info</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.source || '-'}
                    </TableCell>
                    <TableCell className="text-foreground font-medium">
                      ${client.total_spent?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="max-w-xs">
                        {client.services_bought && client.services_bought.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {client.services_bought.slice(0, 2).map((service, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                            {client.services_bought.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{client.services_bought.length - 2} more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 md:gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedClient(client);
                            setIsModalOpen(true);
                          }}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClient(client)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

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