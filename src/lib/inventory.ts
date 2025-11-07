import { supabase } from './supabase';
import { subscriptionService } from './subscriptionService';
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
import { getNowInTunisia, getStartOfDayInTunisia, addDaysInTunisia, getNowISOInTunisia } from './dateUtils';

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
    const now = getNowInTunisia();
    const today = getStartOfDayInTunisia();
    const threeDaysFromNow = addDaysInTunisia(today, 3);
    
    switch (filter.time_bucket) {
      case 'today':
        query = query.gte('end_at', today.toISOString()).lt('end_at', addDaysInTunisia(today, 1).toISOString());
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
  
  // Date range filters
  if (filter?.start_date_after) {
    query = query.gte('start_at', filter.start_date_after);
  }
  if (filter?.start_date_before) {
    query = query.lte('start_at', filter.start_date_before);
  }
  if (filter?.end_date_after) {
    query = query.gte('end_at', filter.end_date_after);
  }
  if (filter?.end_date_before) {
    query = query.lte('end_at', filter.end_date_before);
  }
  
  // Seat count filters
  if (filter?.min_seats !== undefined) {
    query = query.gte('max_seats', filter.min_seats);
  }
  if (filter?.max_seats !== undefined) {
    query = query.lte('max_seats', filter.max_seats);
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
  // First get the current pool to check if max_seats changed
  const { data: currentPool, error: fetchError } = await getResourcePool(id);
  if (fetchError) {
    console.error('Error fetching current pool:', fetchError);
    return { data: null, error: fetchError };
  }

  console.log('Updating pool:', id, 'with data:', data, 'current pool:', currentPool);

  // Update the pool
  const result = await supabase
    .from('resource_pools')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (result.error) {
    console.error('Error updating pool in database:', result.error);
    return result;
  }

  console.log('Pool updated successfully:', result.data);

  // If pool was just marked dead, mark linked subscriptions as overdue
  try {
    if (typeof data.is_alive === 'boolean' && currentPool && currentPool.is_alive && !data.is_alive) {
      console.log('Pool marked dead, marking linked subscriptions as overdue');
      await markLinkedSubscriptionsOverdue([id]);
    }
  } catch (e) {
    console.warn('Failed to mark linked subscriptions overdue for pool', id, e);
  }

  // If pool end date changed, recalculate renewal dates for all linked subscriptions
  if (data.end_at && currentPool && data.end_at !== currentPool.end_at) {
    try {
      console.log('Pool end date changed, recalculating renewal dates for linked subscriptions');
      await recalculateRenewalDatesForPool(id);
    } catch (e) {
      console.warn('Failed to recalculate renewal dates for pool', id, e);
    }
  }

  // If max_seats changed, ensure we have exactly the right number of seats
  if (data.max_seats !== undefined && data.max_seats !== currentPool.max_seats) {
    await ensureCorrectSeatCount(id, data.max_seats);
  }

  return result;
}

// Helper function to ensure we have exactly the right number of seats
async function ensureCorrectSeatCount(poolId: string, targetSeatCount: number) {
  console.log(`Ensuring pool ${poolId} has exactly ${targetSeatCount} seats`);
  
  // Get all existing seats
  const { data: existingSeats, error: seatsError } = await supabase
    .from('resource_pool_seats')
    .select('id, seat_index, seat_status')
    .eq('pool_id', poolId)
    .order('seat_index', { ascending: true });
  
  if (seatsError) {
    console.error('Error fetching existing seats:', seatsError);
    return;
  }
  
  const currentSeatCount = existingSeats?.length || 0;
  console.log(`Current seat count: ${currentSeatCount}, Target: ${targetSeatCount}`);
  
  if (currentSeatCount < targetSeatCount) {
    // Need to add seats
    const seatsToAdd = targetSeatCount - currentSeatCount;
    console.log(`Adding ${seatsToAdd} seats`);
    
    const newSeats = Array.from({ length: seatsToAdd }, (_, i) => ({
      pool_id: poolId,
      seat_index: currentSeatCount + i + 1,
      seat_status: 'available' as const,
    }));
    
    const { data: insertedSeats, error: insertError } = await supabase
      .from('resource_pool_seats')
      .insert(newSeats)
      .select('*');
    
    if (insertError) {
      console.error('Error inserting seats:', insertError);
    } else {
      console.log('Successfully inserted seats:', insertedSeats);
    }
  } else if (currentSeatCount > targetSeatCount) {
    // Need to remove seats (only unassigned ones)
    const seatsToRemove = currentSeatCount - targetSeatCount;
    console.log(`Removing ${seatsToRemove} seats`);
    
    // Get unassigned seats sorted by seat_index descending (remove highest indices first)
    const unassignedSeats = existingSeats
      ?.filter(seat => seat.seat_status === 'available')
      ?.sort((a, b) => b.seat_index - a.seat_index)
      ?.slice(0, seatsToRemove) || [];
    
    if (unassignedSeats.length > 0) {
      const seatIdsToDelete = unassignedSeats.map(seat => seat.id);
      
      const { error: deleteError } = await supabase
        .from('resource_pool_seats')
        .delete()
        .in('id', seatIdsToDelete);
        
      if (deleteError) {
        console.error('Error deleting seats:', deleteError);
      } else {
        console.log('Successfully deleted excess seats');
      }
    }
  }
  
  // Verify final count
  const { data: finalSeats, error: finalError } = await supabase
    .from('resource_pool_seats')
    .select('id')
    .eq('pool_id', poolId);
  
  if (!finalError) {
    console.log(`Final seat count: ${finalSeats?.length || 0}`);
  }
}

export async function deleteResourcePool(id: string) {
  return supabase.from('resource_pools').delete().eq('id', id);
}

export async function archiveResourcePool(id: string) {
  const result = await supabase
    .from('resource_pools')
    .update({ 
      status: 'expired',
      is_alive: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*')
    .single();

  if (!result.error) {
    try {
      await markLinkedSubscriptionsOverdue([id]);
    } catch (e) {
      console.warn('Failed to mark linked subscriptions overdue when archiving pool', id, e);
    }
  }

  return result;
}

export async function archiveExpiredPools() {
  const now = getNowInTunisia();
  const result = await supabase
    .from('resource_pools')
    .update({ 
      status: 'expired',
      is_alive: false,
      updated_at: getNowISOInTunisia()
    })
    .lt('end_at', now.toISOString())
    .in('status', ['active', 'overdue'])
    .select('*');

  if (result.data && result.data.length > 0) {
    try {
      const poolIds = result.data.map((p: any) => p.id);
      await markLinkedSubscriptionsOverdue(poolIds);
    } catch (e) {
      console.warn('Failed to mark linked subscriptions overdue for expired pools', e);
    }
  }

  return result;
}

export async function bulkArchivePools(poolIds: string[]) {
  const result = await supabase
    .from('resource_pools')
    .update({ 
      status: 'expired',
      is_alive: false,
      updated_at: new Date().toISOString()
    })
    .in('id', poolIds)
    .select('*');

  if (!result.error) {
    try {
      await markLinkedSubscriptionsOverdue(poolIds);
    } catch (e) {
      console.warn('Failed to mark linked subscriptions overdue for bulk archive', e);
    }
  }

  return result;
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
  
  const result = await query.order('seat_index');
  console.log(`getPoolSeats for pool ${poolId}:`, result);
  return result;
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
  // First, get the seat to find its pool_id
  const { data: seat, error: seatError } = await supabase
    .from('resource_pool_seats')
    .select('pool_id')
    .eq('id', seatId)
    .single();

  if (seatError || !seat) {
    return { data: null, error: seatError || new Error('Seat not found') };
  }

  // Update the seat
  const seatUpdate = supabase
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

  // If a subscription is being assigned, also update the subscription to link it to this pool and seat
  let subscriptionUpdate = null;
  if (assignment.subscriptionId) {
    subscriptionUpdate = supabase
      .from('subscriptions')
      .update({
        resource_pool_id: seat.pool_id,
        resource_pool_seat_id: seatId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment.subscriptionId);
  }

  // Execute updates
  if (subscriptionUpdate) {
    const [seatResult, subResult] = await Promise.all([seatUpdate, subscriptionUpdate]);
    
    if (seatResult.error) return { data: null, error: seatResult.error };
    if (subResult.error) return { data: null, error: subResult.error };
    
    return seatResult;
  } else {
    return await seatUpdate;
  }
}

export async function unassignSeat(seatId: string) {
  // First, get the current seat assignment to find the subscription
  const { data: seat, error: seatError } = await supabase
    .from('resource_pool_seats')
    .select('assigned_subscription_id')
    .eq('id', seatId)
    .single();

  if (seatError) {
    return { data: null, error: seatError };
  }

  // Update the seat
  const seatUpdate = supabase
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

  // If there was a subscription assigned, also unlink it from the pool and seat
  let subscriptionUpdate = null;
  if (seat?.assigned_subscription_id) {
    subscriptionUpdate = supabase
      .from('subscriptions')
      .update({
        resource_pool_id: null,
        resource_pool_seat_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', seat.assigned_subscription_id);
  }

  // Execute updates
  if (subscriptionUpdate) {
    const [seatResult, subResult] = await Promise.all([seatUpdate, subscriptionUpdate]);
    
    if (seatResult.error) return { data: null, error: seatResult.error };
    if (subResult.error) return { data: null, error: subResult.error };
    
    return seatResult;
  } else {
    return await seatUpdate;
  }
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
    .order('created_at', { ascending: false }); // Show newest pools first
  
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

// Helper: mark subscriptions linked to the given pools as overdue
async function markLinkedSubscriptionsOverdue(poolIds: string[]) {
  if (!poolIds || poolIds.length === 0) return;
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
      })
      .in('resource_pool_id', poolIds)
      .in('status', ['active', 'paused'])
      .select('id');
    
    if (error) {
      console.error('markLinkedSubscriptionsOverdue error:', error);
    } else {
      console.log(`Marked ${data?.length || 0} subscriptions as overdue for pools:`, poolIds);
    }
  } catch (error) {
    console.error('markLinkedSubscriptionsOverdue exception:', error);
  }
}

// Helper: recalculate renewal dates for all active subscriptions linked to a pool
async function recalculateRenewalDatesForPool(poolId: string) {
  try {
    // Get all active subscriptions linked to this pool
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('resource_pool_id', poolId)
      .eq('status', 'active');
    
    if (error) {
      console.error('Error fetching subscriptions for pool:', error);
      return;
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active subscriptions found for pool ${poolId}`);
      return;
    }
    
    console.log(`Recalculating renewal dates for ${subscriptions.length} subscriptions linked to pool ${poolId}`);
    
    // Recalculate renewal date for each subscription
    const results = await Promise.allSettled(
      subscriptions.map(sub => subscriptionService.recalculateRenewalDateForPool(sub.id))
    );
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Successfully recalculated renewal dates for ${successCount} subscriptions`);
    if (failureCount > 0) {
      console.warn(`Failed to recalculate renewal dates for ${failureCount} subscriptions`);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to recalculate renewal date for subscription ${subscriptions[index].id}:`, result.reason);
        }
      });
    }
  } catch (error) {
    console.error('Error recalculating renewal dates for pool:', error);
  }
}

// Sync function: mark all subscriptions linked to dead pools as overdue
export async function syncSubscriptionsForDeadPools() {
  try {
    console.log('Syncing subscriptions linked to dead pools...');
    
    // Find all dead pools
    const { data: deadPools, error: poolsError } = await supabase
      .from('resource_pools')
      .select('id')
      .eq('is_alive', false);
    
    if (poolsError) {
      console.error('Error fetching dead pools:', poolsError);
      return { error: poolsError };
    }
    
    if (!deadPools || deadPools.length === 0) {
      console.log('No dead pools found');
      return { data: { count: 0 } };
    }
    
    const deadPoolIds = deadPools.map(p => p.id);
    console.log(`Found ${deadPoolIds.length} dead pools`);
    
    // Mark subscriptions linked to dead pools as overdue
    const { data: updatedSubs, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
      })
      .in('resource_pool_id', deadPoolIds)
      .in('status', ['active', 'paused'])
      .select('id');
    
    if (updateError) {
      console.error('Error updating subscriptions for dead pools:', updateError);
      return { error: updateError };
    }
    
    const count = updatedSubs?.length || 0;
    console.log(`Marked ${count} subscriptions as overdue for dead pools`);
    
    return { data: { count } };
  } catch (error) {
    console.error('syncSubscriptionsForDeadPools exception:', error);
    return { error };
  }
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
  // First check if the pool is dead - if so, mark subscription as overdue when linking
  const { data: pool, error: poolError } = await getResourcePool(poolId);
  if (poolError) {
    console.error('Error fetching pool when linking subscription:', poolError);
  }
  
  const shouldMarkOverdue = pool && !pool.is_alive;
  
  if (seatId) {
    // Link to specific seat - update both subscription and seat
    const subscriptionUpdateData: any = {
      resource_pool_id: poolId,
      resource_pool_seat_id: seatId,
      updated_at: new Date().toISOString(),
    };
    
    // Mark overdue if pool is dead
    if (shouldMarkOverdue) {
      subscriptionUpdateData.status = 'overdue';
    }
    
    const subscriptionUpdate = supabase
      .from('subscriptions')
      .update(subscriptionUpdateData)
      .eq('id', subscriptionId);

    // Also update the seat to mark it as assigned with assignment details
    const seatUpdate = supabase
      .from('resource_pool_seats')
      .update({
        seat_status: 'assigned',
        assigned_subscription_id: subscriptionId,
        assigned_email: assignment?.email || null,
        assigned_client_id: assignment?.clientId || null,
        assigned_at: assignment?.assignedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', seatId);

    // Execute both updates
    const [subResult, seatResult] = await Promise.all([subscriptionUpdate, seatUpdate]);
    
    if (subResult.error) return { data: null, error: subResult.error };
    if (seatResult.error) return { data: null, error: seatResult.error };
    
    if (shouldMarkOverdue) {
      console.log(`Subscription ${subscriptionId} linked to dead pool ${poolId}, marked as overdue`);
    }
    
    // Recalculate renewal date with pool awareness
    try {
      await subscriptionService.recalculateRenewalDateForPool(subscriptionId);
    } catch (error) {
      console.error('Error recalculating renewal date for pool link:', error);
    }
    
    return subResult;
  } else {
    // Auto-assign next available seat
    const { data: seatData, error: seatError } = await assignNextFreeSeat(poolId, assignment || {});
    if (seatError) return { data: null, error: seatError };
    
    const subscriptionUpdateData: any = {
      resource_pool_id: poolId,
      resource_pool_seat_id: seatData,
      updated_at: new Date().toISOString(),
    };
    
    // Mark overdue if pool is dead
    if (shouldMarkOverdue) {
      subscriptionUpdateData.status = 'overdue';
    }
    
    const result = await supabase
      .from('subscriptions')
      .update(subscriptionUpdateData)
      .eq('id', subscriptionId);

    if (shouldMarkOverdue && !result.error) {
      console.log(`Subscription ${subscriptionId} linked to dead pool ${poolId}, marked as overdue`);
    }

    // Recalculate renewal date with pool awareness
    if (!result.error) {
      try {
        await subscriptionService.recalculateRenewalDateForPool(subscriptionId);
      } catch (error) {
        console.error('Error recalculating renewal date for pool link:', error);
      }
    }
    
    return result;
  }
}

export async function unlinkSubscriptionFromPool(subscriptionId: string) {
  // First get the current seat assignment
  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('resource_pool_seat_id, resource_pool_id')
    .eq('id', subscriptionId)
    .single();
  
  if (fetchError) {
    return { data: null, error: fetchError };
  }
    
  // If there's a seat assigned, unassign it first using the RPC function
  // This ensures the seat is properly unassigned from the pool at the database level
  if (subscription?.resource_pool_seat_id) {
    // Use the RPC function which handles bidirectional sync at the database level
    // This will:
    // 1. Unassign the seat (set to available, clear assignments)
    // 2. Unlink the subscription from the pool and seat
    const { error: unassignError } = await unassignSeatRPC(subscription.resource_pool_seat_id);
    
    if (unassignError) {
      console.error('Error unassigning seat via RPC:', unassignError);
      // If RPC fails, try the JavaScript function as a fallback
      const { error: fallbackError } = await unassignSeat(subscription.resource_pool_seat_id);
      
      if (fallbackError) {
        console.error('Error unassigning seat via fallback method:', fallbackError);
        // Continue anyway - the database trigger will handle it when we update the subscription
      }
    }
  }
  
  // Remove the links from subscription
  // This will also trigger the database trigger (fn_sync_subscription_seat_assignment)
  // that ensures the seat is unassigned, providing an additional safety net
  const result = await supabase
    .from('subscriptions')
    .update({
      resource_pool_id: null,
      resource_pool_seat_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
  
  // If there was an error updating the subscription, return it
  if (result.error) {
    return result;
  }
  
  // Recalculate renewal date after unlinking (will use standard strategy logic since no pool)
  try {
    await subscriptionService.recalculateRenewalDateForPool(subscriptionId);
  } catch (error) {
    console.error('Error recalculating renewal date after unlinking pool:', error);
    // Don't fail the unlink operation if recalculation fails
  }
  
  // Verify the seat was unassigned (if there was one)
  if (subscription?.resource_pool_seat_id) {
    const { data: seat, error: seatCheckError } = await supabase
      .from('resource_pool_seats')
      .select('seat_status, assigned_subscription_id')
      .eq('id', subscription.resource_pool_seat_id)
      .single();
    
    if (!seatCheckError && seat) {
      // Verify the seat is now available and not assigned to this subscription
      if (seat.seat_status !== 'available' || seat.assigned_subscription_id === subscriptionId) {
        console.warn('Seat may not have been properly unassigned. Status:', seat.seat_status, 'Assigned to:', seat.assigned_subscription_id);
      }
    }
  }
  
  return result;
}

// Get pool information for a subscription
export async function getPoolForSubscription(subscriptionId: string): Promise<{ data: ResourcePool | null; error: any }> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      resource_pool_id,
      resource_pools (
        id,
        provider,
        pool_type,
        login_email,
        login_secret,
        notes,
        start_at,
        end_at,
        is_alive,
        max_seats,
        used_seats,
        status,
        created_at,
        updated_at
      )
    `)
    .eq('id', subscriptionId)
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: data?.resource_pools || null, error: null };
}

// Search for pools by seat email
export async function searchPoolsBySeatEmail(searchTerm: string): Promise<{ data: string[]; error: any }> {
  // Find seats where assigned_email matches the search term (case-insensitive)
  const { data: seats, error } = await supabase
    .from('resource_pool_seats')
    .select('pool_id')
    .ilike('assigned_email', `%${searchTerm}%`)
    .not('assigned_email', 'is', null);

  if (error) {
    return { data: [], error };
  }

  // Extract unique pool IDs
  const poolIds = Array.from(new Set((seats || []).map(seat => seat.pool_id)));
  
  return { data: poolIds, error: null };
}
