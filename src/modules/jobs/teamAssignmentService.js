import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient.js';
import { listAssignableShopMembers } from './teamAssignment.js';

export async function getAssignableShopMembers(shopId) {
  if (!shopId) {
    throw new Error('A shop is required to load assignable technicians.');
  }
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_assignable_shop_members', {
    target_shop_id: shopId
  });
  if (error) {
    throw error;
  }

  return listAssignableShopMembers((data || []).map(fromDbAssignableMember), shopId);
}

export async function updateJobAssignment({
  jobId,
  shopId,
  assignedMemberId = '',
  expectedAssignmentUpdatedAt = null
} = {}) {
  if (!jobId || !shopId) {
    throw new Error('Job and shop context are required to update an assignment.');
  }

  if (!hasSupabaseConfig || !supabase) {
    return {
      jobId,
      shopId,
      assignedMemberId,
      assignedMemberDisplayName: '',
      assignmentUpdatedAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase.rpc('update_job_assignment', {
    target_job_id: jobId,
    target_assigned_member_id: assignedMemberId || null,
    expected_assignment_updated_at: expectedAssignmentUpdatedAt || null
  });
  if (error) {
    throw new Error(error.message || 'Unable to update the assigned technician.');
  }
  if (!data || data.shopId !== shopId) {
    throw new Error('The assignment response did not match the active shop. Refresh and try again.');
  }

  return data;
}

function fromDbAssignableMember(member = {}) {
  return {
    id: member.id,
    shopId: member.shop_id || member.shopId,
    userId: member.user_id || member.userId,
    displayName: member.display_name || member.displayName || '',
    role: member.role || 'viewer',
    status: member.status || ''
  };
}
