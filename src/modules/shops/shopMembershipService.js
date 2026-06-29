import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from './shopConfig';

export async function getCurrentUserShopMemberships() {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  const userId = userData.user?.id;
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_current_user_shop_memberships');

  if (error) {
    throw error;
  }

  const memberships = (data || []).map(fromDbMembership);
  if (!memberships.length) {
    return memberships;
  }

  const shopIds = memberships.map((membership) => membership.shopId);
  const { data: profiles, error: profileError } = await supabase
    .from('shop_profiles')
    .select('shop_id, shop_name')
    .in('shop_id', shopIds);

  if (profileError) {
    console.error('Shop profile names failed to load.', profileError);
    return memberships.map((membership) => ({
      ...membership,
      shopName: titleFromShopId(membership.shopId)
    }));
  }

  const profileNamesByShopId = new Map((profiles || []).map((profile) => [profile.shop_id, profile.shop_name]));
  return memberships.map((membership) => ({
    ...membership,
    shopName: profileNamesByShopId.get(membership.shopId) || membership.shopName || titleFromShopId(membership.shopId)
  }));
}

export async function getCurrentShopMembership(shopId = getCurrentShopId()) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const memberships = await getCurrentUserShopMemberships();
  const rpcMembership = memberships.find((membership) => membership.shopId === shopId);
  if (rpcMembership) {
    return rpcMembership;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  const userId = userData.user?.id;
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('shop_members')
    .select('id, shop_id, user_id, role, display_name, created_at, updated_at')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? fromDbMembership(data) : null;
}

export async function bootstrapCurrentUserAsOwner(shopId = getCurrentShopId(), shopName = '') {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc('bootstrap_current_user_as_owner', {
    target_shop_id: shopId,
    target_shop_name: shopName
  });

  if (error) {
    throw error;
  }

  return fromDbMembership(data);
}

export async function getShopMembers(shopId = getCurrentShopId()) {
  if (!hasSupabaseConfig || !supabase || !shopId) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_shop_members', {
    target_shop_id: shopId
  });

  if (error) {
    throw error;
  }

  return (data || []).map(fromDbMemberDetail);
}

export async function addShopMemberByEmail({ shopId = getCurrentShopId(), email, role = 'tech', displayName = '' }) {
  if (!hasSupabaseConfig || !supabase || !shopId) {
    return null;
  }

  const { data, error } = await supabase.rpc('upsert_shop_member_by_email', {
    target_shop_id: shopId,
    target_email: email,
    target_role: role,
    target_display_name: displayName
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateShopMemberRole(memberId, role) {
  if (!hasSupabaseConfig || !supabase || !memberId) {
    return null;
  }

  const { data, error } = await supabase.rpc('update_shop_member_role', {
    target_member_id: memberId,
    target_role: role
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function removeShopMember(memberId) {
  if (!hasSupabaseConfig || !supabase || !memberId) {
    return null;
  }

  const { data, error } = await supabase.rpc('remove_shop_member', {
    target_member_id: memberId
  });

  if (error) {
    throw error;
  }

  return data;
}

function fromDbMembership(membership) {
  return {
    id: membership.id,
    shopId: membership.shop_id,
    userId: membership.user_id,
    role: membership.role,
    displayName: membership.display_name || '',
    shopName: membership.shop_name || membership.shopName || '',
    createdAt: membership.created_at,
    updatedAt: membership.updated_at
      || membership.updatedAt,
    effectiveMemberAccess: membership.effective_member_access
      ?? membership.effectiveMemberAccess
      ?? true
  };
}

function fromDbMemberDetail(member) {
  return {
    id: member.id,
    shopId: member.shop_id || member.shopId,
    userId: member.user_id || member.userId,
    email: member.email || '',
    role: member.role || 'viewer',
    displayName: member.display_name || member.displayName || '',
    status: member.status || '',
    lastSignInAt: member.last_sign_in_at || member.lastSignInAt || '',
    createdAt: member.created_at || member.createdAt || '',
    updatedAt: member.updated_at || member.updatedAt || '',
    effectiveMemberAccess: member.effective_member_access ?? member.effectiveMemberAccess ?? true
  };
}

function titleFromShopId(shopId = '') {
  return String(shopId || '')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'FretTrack Shop';
}
