import { supabase } from './supabase';
import { 
  ResourcePool, 
  ResourcePoolSeat, 
  PoolStats, 
  PoolWithSeats, 
  SeatAssignment, 
  CreatePoolData, 
  UpdatePoolData, 
  PoolFilter, 
  SeatFilter 
} from '../types/inventory';

// Resource Pool CRUD operations
export async function listResourcePools(filter?: PoolFilter) {
  let query = supabase.from('resource_pools').select('*');
  
  if (filter?.provider) {
    query = query.eq('provider', filter.provider);
  }
  if (filter?.status) {
    query = query.eq('status', filter.status);
  }
  if (filter?.pool_type) {
    query = query.eq('pool_type', filter.pool_type);
  }
  if (typeof filter?.alive === 'boolean') {
    query = query.eq('is_alive', filter.alive);
  }
  if (filter?.time_bucket) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    switch (filter.time_bucket) {
      case 'today':
        query = query.gte('end_at', today.toISOString()).lt('end_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());
        break;
      case '3days':
        query = query.gte('end_at', today.toISOString()).lt('end_at', threeDaysFromNow.toISOString());
        break;
      case 'overdue':
        query = query.lt('end_at', today.toISOString()).in('status', ['active', 'overdue']);
        break;
      case 'expired':
        query = query.eq('status', 'expired');
        break;
    }
  }
  
  return query.order('end_at', { ascending: true });
}

export async function getResourcePool(id: string) {
  return supabase.from('resource_pools').select('*').eq('id', id).single();
}

export async function createResourcePool(data: CreatePoolData) {
  const result = await supabase.from('resource_pools').insert(data).select('*').single();
  
  if (result.data) {
    // Initialize seats for the new pool
    await initSeats(result.data.id, data.max_seats);
  }
  
  return result;
}

export async function updateResourcePool(id: string, data: UpdatePoolData) {
  return supabase
    .from('resource_pools')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
}

export async function deleteResourcePool(id: string) {
  return supabase.from('resource_pools').delete().eq('id', id);
}

// Seat management
export async function initSeats(poolId: string, maxSeats: number) {
  const seats = Array.from({ length: maxSeats }, (_, i) => ({
    pool_id: poolId,
    seat_index: i + 1,
    seat_status: 'available' as const,
  }));
  
  return supabase.from('resource_pool_seats').insert(seats);
}

export async function getPoolSeats(poolId: string, filter?: SeatFilter) {
  let query = supabase
    .from('resource_pool_seats')
    .select('*')
    .eq('pool_id', poolId);
    
  if (filter?.status) {
    query = query.eq('seat_status', filter.status);
  }
  if (filter?.assigned_client_id) {
    query = query.eq('assigned_client_id', filter.assigned_client_id);
  }
  if (filter?.assigned_subscription_id) {
    query = query.eq('assigned_subscription_id', filter.assigned_subscription_id);
  }
  
  return query.order('seat_index');
}

export async function getPoolWithSeats(poolId: string) {
  const { data: pool, error: poolError } = await getResourcePool(poolId);
  if (poolError) return { data: null, error: poolError };
  
  const { data: seats, error: seatsError } = await getPoolSeats(poolId);
  if (seatsError) return { data: null, error: seatsError };
  
  return {
    data: { ...pool, seats: seats || [] } as PoolWithSeats,
    error: null
  };
}

export async function assignSeat(seatId: string, assignment: SeatAssignment) {
  return supabase
    .from('resource_pool_seats')
    .update({
      assigned_email: assignment.email || null,
      assigned_client_id: assignment.clientId || null,
      assigned_subscription_id: assignment.subscriptionId || null,
      assigned_at: assignment.assignedAt || new Date().toISOString(),
      unassigned_at: null,
      seat_status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', seatId)
    .select('*')
    .single();
}

export async function unassignSeat(seatId: string) {
  return supabase
    .from('resource_pool_seats')
    .update({
      assigned_email: null,
      assigned_client_id: null,
      assigned_subscription_id: null,
      unassigned_at: new Date().toISOString(),
      seat_status: 'available',
      updated_at: new Date().toISOString(),
    })
    .eq('id', seatId);
}

// RPC functions
export async function assignNextFreeSeat(poolId: string, assignment: SeatAssignment) {
  return supabase.rpc('assign_next_free_seat', {
    p_pool_id: poolId,
    p_email: assignment.email || null,
    p_client_id: assignment.clientId || null,
    p_subscription_id: assignment.subscriptionId || null,
  });
}

export async function unassignSeatRPC(seatId: string) {
  return supabase.rpc('unassign_seat', {
    p_seat_id: seatId,
  });
}

export async function getPoolStats(poolId: string) {
  return supabase.rpc('get_pool_stats', {
    p_pool_id: poolId,
  });
}

export async function refreshPoolStatus() {
  return supabase.rpc('fn_refresh_pool_status');
}

// Utility functions
export async function getAvailablePoolsForService(serviceProvider: string) {
  console.log('Querying pools for provider:', serviceProvider);
  const result = await supabase
    .from('resource_pools')
    .select('*')
    .eq('provider', serviceProvider)
    .order('end_at', { ascending: true });
  
  console.log('Pools query result:', result);
  return result;
}

export async function getAvailableSeatsInPool(poolId: string) {
  return supabase
    .from('resource_pool_seats')
    .select('*')
    .eq('pool_id', poolId)
    .eq('seat_status', 'available')
    .order('seat_index');
}

export async function getAllAssignedSeats() {
  console.log('Fetching all assigned seats...');
  
  // Try to find assignments using the subscriptions table first
  // This is more reliable since we know subscriptions can be linked to pools
  const { data: linkedSubscriptions, error: subsError } = await supabase
    .from('subscriptions')
    .select(`
      id,
      resource_pool_id,
      resource_pool_seat_id,
      client_id,
      service_id,
      status,
      notes,
      clients (
        id,
        name,
        email
      ),
      services (
        id,
        product_service
      )
    `)
    .not('resource_pool_id', 'is', null)
    .not('resource_pool_seat_id', 'is', null);
  
  console.log('Linked subscriptions:', linkedSubscriptions);
  
  if (subsError) {
    console.error('Error fetching linked subscriptions:', subsError);
    return { data: [], error: subsError };
  }
  
  if (!linkedSubscriptions || linkedSubscriptions.length === 0) {
    console.log('No linked subscriptions found');
    return { data: [], error: null };
  }
  
  // Now get the seat and pool information for these subscriptions
  const seatIds = linkedSubscriptions.map(sub => sub.resource_pool_seat_id).filter(Boolean);
  const poolIds = linkedSubscriptions.map(sub => sub.resource_pool_id).filter(Boolean);
  
  const { data: seats, error: seatsError } = await supabase
    .from('resource_pool_seats')
    .select(`
      *,
      resource_pools (
        id,
        provider,
        pool_type,
        login_email,
        status,
        end_at
      )
    `)
    .in('id', seatIds);
  
  console.log('Seats for linked subscriptions:', seats);
  
  if (seatsError) {
    console.error('Error fetching seats:', seatsError);
    return { data: [], error: seatsError };
  }
  
  // Combine the data to create assignment objects
  const assignments = linkedSubscriptions.map(subscription => {
    const seat = seats?.find(s => s.id === subscription.resource_pool_seat_id);
    if (!seat) return null;
    
    return {
      ...seat,
      clients: subscription.clients,
      subscriptions: {
        id: subscription.id,
        service_id: subscription.service_id,
        client_id: subscription.client_id,
        status: subscription.status,
        notes: subscription.notes
      }
    };
  }).filter(Boolean);
  
  console.log('Final assignments:', assignments);
  return { data: assignments, error: null };
}

// Subscription integration
export async function linkSubscriptionToPool(subscriptionId: string, poolId: string, seatId?: string, assignment?: SeatAssignment) {
  if (seatId) {
    // Link to specific seat - update both subscription and seat
    const subscriptionUpdate = supabase
      .from('subscriptions')
      .update({
        resource_pool_id: poolId,
        resource_pool_seat_id: seatId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    // Also update the seat to mark it as assigned
    const seatUpdate = supabase
      .from('resource_pool_seats')
      .update({
        seat_status: 'assigned',
        assigned_subscription_id: subscriptionId,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', seatId);

    // Execute both updates
    const [subResult, seatResult] = await Promise.all([subscriptionUpdate, seatUpdate]);
    
    if (subResult.error) return { data: null, error: subResult.error };
    if (seatResult.error) return { data: null, error: seatResult.error };
    
    return subResult;
  } else {
    // Auto-assign next available seat
    const { data: seatData, error: seatError } = await assignNextFreeSeat(poolId, assignment || {});
    if (seatError) return { data: null, error: seatError };
    
    return supabase
      .from('subscriptions')
      .update({
        resource_pool_id: poolId,
        resource_pool_seat_id: seatData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);
  }
}

export async function unlinkSubscriptionFromPool(subscriptionId: string) {
  // First get the current seat assignment
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('resource_pool_seat_id')
    .eq('id', subscriptionId)
    .single();
    
  if (subscription?.resource_pool_seat_id) {
    // Unassign the seat
    await unassignSeat(subscription.resource_pool_seat_id);
  }
  
  // Remove the links from subscription
  return supabase
    .from('subscriptions')
    .update({
      resource_pool_id: null,
      resource_pool_seat_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
}
