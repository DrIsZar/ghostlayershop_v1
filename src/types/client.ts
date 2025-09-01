export interface Client {
    id: string;
    name: string;
    type: 'client' | 'reseller';
    email?: string;
    telegram?: string;
    discord?: string;
    notes?: string;
    source?: string;
    created_at: string;
    updated_at: string;
}

export interface ClientPurchase {
    id: string;
    client_id: string;
    service_id: string;
    transaction_id: string;
    purchase_date: string;
    amount: number;
    notes?: string;
}

export interface ClientStatistics {
    id: string;
    name: string;
    total_purchases: number;
    total_spent: number;
    services_bought: string[];
}
