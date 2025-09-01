import { supabase } from './supabase';
import type { Client, ClientPurchase, ClientStatistics } from '../types/client';

export const clientsDb = {
    async getAll() {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('name');
        if (error) throw error;
        return data as Client[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Client;
    },

    async create(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('clients')
            .insert(client)
            .select()
            .single();
        if (error) throw error;
        return data as Client;
    },

    async update(id: string, updates: Partial<Client>) {
        const { data, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Client;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getPurchases(clientId: string) {
        const { data, error } = await supabase
            .from('client_purchases')
            .select(`
                *,
                services (name),
                transactions (date, status)
            `)
            .eq('client_id', clientId);
        if (error) throw error;
        return data as (ClientPurchase & {
            services: { name: string };
            transactions: { date: string; status: string };
        })[];
    },

    async getStatistics(clientId: string): Promise<ClientStatistics> {
        try {
            // Get client basic info
            const client = await this.getById(clientId);
            
            // Get all transactions for this client
            const { data: transactions, error: transError } = await supabase
                .from('transactions')
                .select(`
                    *,
                    services (
                        product_service
                    )
                `)
                .eq('client_id', clientId);

            if (transError) throw transError;

            // Calculate statistics
            const totalSpent = transactions?.reduce((sum, t) => sum + (t.selling_price || 0), 0) || 0;
            const totalPurchases = transactions?.length || 0;
            const servicesBought = transactions?.map(t => t.services?.product_service).filter(Boolean) || [];
            const uniqueServices = [...new Set(servicesBought)];

            return {
                id: clientId,
                name: client.name,
                total_purchases: totalPurchases,
                total_spent: totalSpent,
                services_bought: uniqueServices
            };
        } catch (error) {
            console.error('Error calculating client statistics:', error);
            // Return default statistics if calculation fails
            const client = await this.getById(clientId);
            return {
                id: clientId,
                name: client.name,
                total_purchases: 0,
                total_spent: 0,
                services_bought: []
            };
        }
    }
};
