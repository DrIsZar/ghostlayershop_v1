import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, Download, Package, ChevronDown, ChevronRight, Clock, Tag, Info, DollarSign, Image } from 'lucide-react';
import { supabase, Service } from '../lib/supabase';
import ServiceModal from '../components/ServiceModal';
import { getServiceLogo, migrateExistingLogos } from '../lib/fileUtils';

// ServiceLogo component for reactive logo display
interface ServiceLogoProps {
  serviceName: string;
  refreshTrigger: number;
  size: 'small' | 'large';
}

const ServiceLogo: React.FC<ServiceLogoProps> = ({ serviceName, refreshTrigger, size }) => {
  const serviceLogo = useMemo(() => {
    // This will re-compute when refreshTrigger changes
    return getServiceLogo(serviceName);
  }, [serviceName, refreshTrigger]);

  const containerClass = size === 'large' 
    ? "w-12 h-12 rounded-xl overflow-hidden bg-gray-700 flex items-center justify-center border-2 border-gray-600 shadow-lg"
    : "w-10 h-10 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center border border-gray-600 shadow-sm";

  const iconSize = size === 'large' ? "h-6 w-6" : "h-4 w-4";

  return (
    <div className={containerClass}>
      {serviceLogo ? (
        <img 
          key={`${serviceName}_${refreshTrigger}`} // Force re-render with new key
          src={serviceLogo} 
          alt={`${serviceName} logo`} 
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <div className={`w-full h-full flex items-center justify-center text-gray-400 ${serviceLogo ? 'hidden' : ''}`}>
        <Image className={iconSize} />
      </div>
    </div>
  );
};

export default function ServicesManager() {
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

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('logoUpdated', handleLogoUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('logoUpdated', handleLogoUpdate);
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
        <div className="text-lg text-gray-400">Loading services...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Services Manager</h1>
          <p className="text-gray-400 mt-1">Manage your products and services</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportServices}
            className="ghost-button flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Extract
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="ghost-button flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Service
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="ghost-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Total Services</h3>
          <p className="text-3xl font-bold text-green-500">{services.length}</p>
        </div>
        <div className="ghost-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Potential Profit</h3>
          <p className="text-3xl font-bold text-green-500">${totalProfit.toFixed(2)}</p>
        </div>
        <div className="ghost-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Avg. Margin</h3>
          <p className="text-3xl font-bold text-green-500">
            {services.length > 0 ? ((totalProfit / services.reduce((sum, s) => sum + s.selling_price, 0)) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="ghost-card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ghost-input pl-10 w-full"
          />
        </div>
      </div>

      {/* Services Table */}
      <div className="ghost-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-800 to-gray-700 border-b border-gray-600">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Service</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Info Needed</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Selling Price</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Profit</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-200 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {sortedFilteredServices.map((service, index) => {
                const profit = service.selling_price - service.cost;
                const isFirstOfGroup = index === 0 || 
                  sortedFilteredServices[index - 1].product_service !== service.product_service;
                const isExpanded = isGroupExpanded(service.product_service);
                
                return (
                  <React.Fragment key={service.id}>
                    {isFirstOfGroup && (
                      <tr className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-t-2 border-blue-500/30 cursor-pointer hover:from-blue-900/30 hover:to-purple-900/30 transition-all duration-200"
                          onClick={() => toggleGroup(service.product_service)}>
                        <td colSpan={8} className="px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button className="p-1 hover:bg-white/10 rounded transition-colors">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-blue-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-blue-400" />
                                )}
                              </button>
                              
                              {/* Service Logo - Improved styling */}
                              <ServiceLogo 
                                serviceName={service.product_service}
                                refreshTrigger={logoRefreshTrigger}
                                size="large"
                              />
                              
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                <span className="text-lg font-bold text-white">
                                  {service.product_service}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full border border-blue-500/30">
                                {sortedFilteredServices.filter(s => s.product_service === service.product_service).length} duration(s)
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isExpanded && (
                      <tr className="hover:bg-gray-700/30 transition-all duration-200 group bg-gray-800/20">
                        <td className="px-6 py-4">
                          <div className="flex items-center pl-8">
                            {/* Service Logo in Detail Row - Improved styling */}
                            <div className="mr-4">
                              <ServiceLogo 
                                serviceName={service.product_service}
                                refreshTrigger={logoRefreshTrigger}
                                size="small"
                              />
                            </div>
                            
                            <span className="text-white font-medium">{service.product_service}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-gradient-to-r from-gray-600 to-gray-500 rounded-full text-xs font-medium text-gray-200 border border-gray-500/50 shadow-sm flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {service.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300 font-medium rounded-lg border border-blue-500/30 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {service.duration}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300 text-sm bg-gray-800/50 px-2 py-1 rounded border border-gray-600/50 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            {service.info_needed}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300 font-mono text-sm bg-gray-800/50 px-3 py-1.5 rounded border border-gray-600/50 flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${service.cost.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300 font-mono text-sm bg-gray-800/50 px-3 py-1.5 rounded border border-gray-600/50 flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${service.selling_price.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 font-bold text-sm rounded-lg border flex items-center gap-1 ${
                            profit >= 0 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}>
                            <DollarSign className="h-3 w-3" />
                            ${profit.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingService(service);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-all duration-200 hover:scale-105"
                              title="Edit Service"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteService(service.id);
                              }}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200 hover:scale-105"
                              title="Delete Service"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          
          {sortedFilteredServices.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-500" />
              </div>
              <p className="text-lg font-medium mb-2">
                {searchTerm ? 'No services found matching your search.' : 'No services yet.'}
              </p>
              <p className="text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'Add your first service to get started!'}
              </p>
            </div>
          )}
        </div>
      </div>

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