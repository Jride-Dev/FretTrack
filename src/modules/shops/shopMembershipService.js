import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from './shopConfig';

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
