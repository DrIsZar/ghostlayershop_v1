import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, Download, Package, ChevronDown, ChevronRight, Clock, Tag, Info, Image } from 'lucide-react';
import { supabase, Service } from '../lib/supabase';
import ServiceModal from '../components/ServiceModal';
import { getServiceLogo, migrateExistingLogos } from '../lib/fileUtils';
import { useCurrency } from '../lib/currency';

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// ServiceLogo component for reactive logo display
interface ServiceLogoProps {
  serviceName: string;
  refreshTrigger: number;
  size: 'small' | 'large';
}

const ServiceLogo: React.FC<ServiceLogoProps> = ({ serviceName, refreshTrigger, size }) => {
  const serviceLogo = useMemo(() => {
    // This will re-compute when refreshTrigger changes
    if (!serviceName) return null;
    return getServiceLogo(serviceName);
  }, [serviceName, refreshTrigger]);

  const containerClass = size === 'large'
    ? "w-12 h-12 rounded-xl overflow-hidden bg-secondary flex items-center justify-center border-2 border-border shadow-lg"
    : "w-10 h-10 rounded-lg overflow-hidden bg-secondary flex items-center justify-center border border-border shadow-sm";

  const iconSize = size === 'large' ? "h-6 w-6" : "h-4 w-4";

  return (
    <div className={containerClass}>
      {serviceLogo ? (
        <img
          key={`${serviceName || 'unknown'}_${refreshTrigger}`} // Force re-render with new key
          src={serviceLogo}
          alt={`${serviceName || 'Service'} logo`}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <div className={`w-full h-full flex items-center justify-center text-muted-foreground ${serviceLogo ? 'hidden' : ''}`}>
        <Image className={iconSize} />
      </div>
    </div>
  );
};

export default function ServicesManager() {
  const { formatCurrency } = useCurrency();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [logoRefreshTrigger, setLogoRefreshTrigger] = useState(0); // State to force re-render of logo

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    // Migrate existing database logos to the new system
    if (services.length > 0) {
      migrateExistingLogos(services);
      // Trigger logo refresh after migration to ensure logos are displayed
      setLogoRefreshTrigger(prev => prev + 1);
    }
  }, [services]);

  // Listen for localStorage changes and custom logo update events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('service_logo_')) {
        // Force logo refresh when localStorage changes
        setLogoRefreshTrigger(prev => prev + 1);
      }
    };

    const handleLogoUpdate = () => {
      // Force logo refresh when custom logo update event is dispatched
      setLogoRefreshTrigger(prev => prev + 1);
    };

    // Periodic logo refresh to ensure logos are always up-to-date
    const logoRefreshInterval = setInterval(() => {
      setLogoRefreshTrigger(prev => prev + 1);
    }, 5000); // Refresh every 5 seconds

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('logoUpdated', handleLogoUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('logoUpdated', handleLogoUpdate);
      clearInterval(logoRefreshInterval);
    };
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);

      // Trigger logo refresh after services are loaded to ensure logos are displayed
      if (data && data.length > 0) {
        setTimeout(() => {
          setLogoRefreshTrigger(prev => prev + 1);
        }, 100); // Small delay to ensure migration completes first
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveService = async (serviceData: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const session = await supabase.auth.getSession();
      if (!session) {
        // Try to sign in anonymously if no session exists
        await supabase.auth.signInWithPassword({
          email: 'anonymous@example.com',
          password: 'anonymous'
        });
      }

      // Handle logo name change if service name changed
      if (editingService && editingService.product_service !== serviceData.product_service) {
        // Update logo key in localStorage if service name changed
        const { updateServiceLogoName } = await import('../lib/fileUtils');
        updateServiceLogoName(editingService.product_service, serviceData.product_service);
      }

      if (editingService) {
        const { data, error } = await supabase
          .from('services')
          .update({
            ...serviceData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingService.id)
          .select();

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
        if (data) console.log('Updated service:', data);
      } else {
        const { data, error } = await supabase
          .from('services')
          .insert([{
            ...serviceData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();

        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }
        if (data) console.log('Inserted service:', data);
      }

      // Force logo refresh immediately after successful save
      setLogoRefreshTrigger(prev => prev + 1);

      await fetchServices();
      setEditingService(null);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving service:', error);
      alert(error.message || 'Error saving service');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchServices();
      setLogoRefreshTrigger(prev => prev + 1); // Refresh logo after deleting
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const filteredServices = services.filter(service =>
    service.product_service.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group services by name and sort by duration
  const groupAndSortServices = (services: Service[]) => {
    // Group services by product_service name
    const grouped = services.reduce((acc, service) => {
      if (!acc[service.product_service]) {
        acc[service.product_service] = [];
      }
      acc[service.product_service].push(service);
      return acc;
    }, {} as Record<string, Service[]>);

    // Sort each group by duration (1 month to 12 months)
    const durationOrder = {
      '1 month': 1,
      '1 Month': 1,
      '2 months': 2,
      '2 Months': 2,
      '3 months': 3,
      '3 Months': 3,
      '4 months': 4,
      '4 Months': 4,
      '5 months': 5,
      '5 Months': 5,
      '6 months': 6,
      '6 Months': 6,
      '7 months': 7,
      '7 Months': 7,
      '8 months': 8,
      '8 Months': 8,
      '9 months': 9,
      '9 Months': 9,
      '10 months': 10,
      '10 Months': 10,
      '11 months': 11,
      '11 Months': 11,
      '12 months': 12,
      '12 Months': 12,
      '1 year': 12,
      '1 Year': 12
    };

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const aOrder = durationOrder[a.duration as keyof typeof durationOrder] || 999;
        const bOrder = durationOrder[b.duration as keyof typeof durationOrder] || 999;
        return aOrder - bOrder;
      });
    });

    // Convert back to array and sort groups alphabetically
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([_, services]) => services);
  };

  const sortedFilteredServices = groupAndSortServices(filteredServices);

  const totalProfit = services.reduce((sum, service) => sum + (service.selling_price - service.cost), 0);

  const toggleGroup = (serviceName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(serviceName)) {
      newExpanded.delete(serviceName);
    } else {
      newExpanded.add(serviceName);
    }
    setExpandedGroups(newExpanded);
  };

  const isGroupExpanded = (serviceName: string) => expandedGroups.has(serviceName);

  const exportServices = () => {
    const csvContent = [
      ['Product/Service', 'Category', 'Duration', 'Info Needed', 'Cost', 'Selling Price', 'Profit', 'Created At', 'Updated At'],
      ...services.map(service => {
        const profit = service.selling_price - service.cost;
        return [
          service.product_service,
          service.category,
          service.duration,
          service.info_needed,
          service.cost.toFixed(2),
          service.selling_price.toFixed(2),
          profit.toFixed(2),
          new Date(service.created_at).toLocaleDateString(),
          new Date(service.updated_at).toLocaleDateString()
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `services_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Services Manager</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your products and services</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={exportServices}>
            <Download className="h-4 w-4 mr-2" />
            Extract
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="animate-fade-in-up">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Total Services</h3>
            <p className="text-3xl font-bold text-foreground">{services.length}</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Potential Profit</h3>
            <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(totalProfit)}</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Avg. Margin</h3>
            <p className="text-3xl font-bold text-foreground">
              {services.length > 0 ? ((totalProfit / services.reduce((sum, s) => sum + s.selling_price, 0)) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
            <Input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Info Needed</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFilteredServices.map((service, index) => {
                const profit = service.selling_price - service.cost;
                const isFirstOfGroup = index === 0 ||
                  sortedFilteredServices[index - 1].product_service !== service.product_service;
                const isExpanded = isGroupExpanded(service.product_service);

                return (
                  <React.Fragment key={service.id}>
                    {isFirstOfGroup && (
                      <TableRow
                        className="bg-secondary/50 border-t-2 border-border cursor-pointer hover:bg-secondary/70 transition-all duration-200"
                        onClick={() => toggleGroup(service.product_service)}
                      >
                        <TableCell colSpan={8}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button className="p-1 hover:bg-secondary rounded transition-colors">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-foreground" />
                                )}
                              </button>

                              {/* Service Logo - Improved styling */}
                              <ServiceLogo
                                serviceName={service.product_service}
                                refreshTrigger={logoRefreshTrigger}
                                size="large"
                              />

                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                <span className="text-lg font-bold text-foreground">
                                  {service.product_service}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {sortedFilteredServices.filter(s => s.product_service === service.product_service).length} duration(s)
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {isExpanded && (
                      <TableRow className="hover:bg-secondary/30 transition-all duration-200 group">
                        <TableCell>
                          <div className="flex items-center pl-8">
                            {/* Service Logo in Detail Row - Improved styling */}
                            <div className="mr-4">
                              <ServiceLogo
                                serviceName={service.product_service}
                                refreshTrigger={logoRefreshTrigger}
                                size="small"
                              />
                            </div>

                            <span className="text-foreground font-medium">{service.product_service}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Tag className="h-3 w-3" />
                            {service.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Clock className="h-3 w-3" />
                            {service.duration}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-sm flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            {service.info_needed}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground font-mono text-sm">
                            {formatCurrency(service.cost)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground font-mono text-sm">
                            {formatCurrency(service.selling_price)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold text-sm ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(profit)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingService(service);
                                setIsModalOpen(true);
                              }}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteService(service.id);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>

          {sortedFilteredServices.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 bg-secondary rounded-full flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-2">
                {searchTerm ? 'No services found matching your search.' : 'No services yet.'}
              </p>
              <p className="text-sm text-muted-foreground/70">
                {searchTerm ? 'Try adjusting your search terms.' : 'Add your first service to get started!'}
              </p>
            </div>
          )}
        </div>
      </Card>

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingService(null);
        }}
        onSave={handleSaveService}
        service={editingService}
        onLogoChange={() => {
          // Force logo refresh when logo changes in modal
          setLogoRefreshTrigger(prev => prev + 1);
        }}
      />
    </div>
  );
}