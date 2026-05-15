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

  const { data, error } = await supabase
    .from('shop_members')
    .select('id, shop_id, user_id, role, display_name, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

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
    shopName: profileNamesByShopId.get(membership.shopId) || titleFromShopId(membership.shopId)
  }));
}

export async function getCurrentShopMembership(shopId = getCurrentShopId()) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
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

export async function bootstrapCurrentUserAsOwner(shopId = getCurrentShopId()) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  const user = userData.user;
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('shop_members')
    .insert({
      shop_id: shopId,
      user_id: user.id,
      role: 'owner',
      display_name: user.email || ''
    })
    .select('id, shop_id, user_id, role, display_name, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return fromDbMembership(data);
}

function fromDbMembership(membership) {
  return {
    id: membership.id,
    shopId: membership.shop_id,
    userId: membership.user_id,
    role: membership.role,
    displayName: membership.display_name || '',
    createdAt: membership.created_at,
    updatedAt: membership.updated_at
  };
}

function titleFromShopId(shopId = '') {
  return String(shopId || '')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'FretTrack Shop';
}
