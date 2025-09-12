export type PoolType = 'admin_console' | 'family' | 'team' | 'workspace';
export type PoolStatus = 'active' | 'paused' | 'completed' | 'overdue' | 'expired';
export type SeatStatus = 'available' | 'reserved' | 'assigned';

export interface ResourcePool {
  id: string;
  provider:
    | 'adobe'
    | 'acrobat'
    | 'apple_one'
    | 'canva'
    | 'chatgpt'
    | 'duolingo'
    | 'lastpass'
    | 'microsoft_365'
    | 'spotify'
    | string; // extensible
  pool_type: PoolType;
  login_email: string;
  login_secret?: string | null;
  notes?: string | null;
  start_at: string; // ISO
  end_at: string;   // ISO
  is_alive: boolean;
  max_seats: number;
  used_seats: number;
  status: PoolStatus;
  created_at: string;
  updated_at: string;
}

export interface ResourcePoolSeat {
  id: string;
  pool_id: string;
  seat_index: number;
  assigned_email?: string | null;
  assigned_client_id?: string | null;
  assigned_subscription_id?: string | null;
  assigned_at?: string | null;
  unassigned_at?: string | null;
  seat_status: SeatStatus;
  created_at: string;
  updated_at: string;
}

export interface PoolStats {
  total_seats: number;
  used_seats: number;
  available_seats: number;
  assigned_seats: number;
  reserved_seats: number;
}

export interface PoolWithSeats extends ResourcePool {
  seats: ResourcePoolSeat[];
}

export interface SeatAssignment {
  email?: string;
  clientId?: string;
  subscriptionId?: string;
  assignedAt?: string;
}

export interface CreatePoolData {
  provider: string;
  pool_type: PoolType;
  login_email: string;
  login_secret?: string;
  notes?: string;
  start_at: string;
  end_at: string;
  max_seats: number;
}

export interface UpdatePoolData extends Partial<CreatePoolData> {
  is_alive?: boolean;
  status?: PoolStatus;
}

export interface PoolFilter {
  provider?: string;
  status?: PoolStatus;
  pool_type?: PoolType;
  alive?: boolean;
  time_bucket?: 'today' | '3days' | 'overdue' | 'expired';
}

export interface SeatFilter {
  pool_id?: string;
  status?: SeatStatus;
  assigned_client_id?: string;
  assigned_subscription_id?: string;
}

export interface AssignmentWithDetails {
  id: string;
  pool_id: string;
  seat_index: number;
  assigned_email?: string | null;
  assigned_client_id?: string | null;
  assigned_subscription_id?: string | null;
  assigned_at?: string | null;
  unassigned_at?: string | null;
  seat_status: SeatStatus;
  created_at: string;
  updated_at: string;
  resource_pools: ResourcePool;
  clients?: {
    id: string;
    name: string;
    email: string;
  } | null;
  subscriptions?: {
    id: string;
    service_id: string;
    client_id: string;
    status: string;
    notes?: string;
  } | null;
}

export interface AssignmentFilter {
  pool_id?: string;
  provider?: string;
  client_id?: string;
  subscription_id?: string;
  assigned_after?: string;
  assigned_before?: string;
}