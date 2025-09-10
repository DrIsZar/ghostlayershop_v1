import { createClient } from '@supabase/supabase-js';
import type { Client } from '../types/client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For now, we'll work without authentication
// The RLS policies should allow access for authenticated users
// If you need authentication, you can enable it in Supabase dashboard

export interface Service {
  id: string;
  product_service: string;
  category: string;
  duration: string;
  info_needed: string;
  cost: number;
  selling_price: number;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  service_id: string;
  client_id?: string;
  date: string;
  cost_at_sale: number;
  selling_price: number;
  notes: string;
  created_at: string;
  updated_at: string;
  services?: Service;
  client?: Client;
}

export const categories = [
  'Software',
  'Streaming',
  'AI',
  'Gaming',
  'Cloud Storage',
  'Productivity',
  'Security',
  'Other'
];