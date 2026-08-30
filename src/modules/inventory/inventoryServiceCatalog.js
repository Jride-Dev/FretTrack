import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';
import {
  releaseDeletedPhotoStorage,
  releasePhotoUsageReservation,
  reservePhotoUsage,
  settlePhotoUsage
} from '../billing/usageCaps';
import {
  cleanText,
  moneyNumber,
  integerNumber,
  normalizeBarcodeSearch,
  toDbPart,
  fromDbPart,
  toDbVendor,
  fromDbVendor
} from './inventoryServiceNormalization.js';

const PART_IMAGES_BUCKET = 'part-images';
const MAX_PART_IMAGE_DIMENSION = 300;

function requireInventoryConfigured() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Inventory requires the live Supabase-backed FretTrack app.');
  }
}

export async function listParts(shopId = getCurrentShopId(), filters = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let query = supabase
    .from('parts')
    .select('*')
    .eq('shop_id', shopId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (filters.activeOnly) {
    query = query.eq('is_active', true);
  }

  const search = cleanText(filters.search);
  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&');
    const barcodeSearch = normalizeBarcodeSearch(search);
    const escapedBarcode = barcodeSearch.replace(/[%_]/g, '\\$&');
    query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%,category.ilike.%${escaped}%,supplier.ilike.%${escaped}%,vendor_sku.ilike.%${escaped}%,barcode_code.ilike.%${escapedBarcode}%,manufacturer.ilike.%${escaped}%,part_number.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const parts = (data || []).map(fromDbPart);
  return filters.lowStockOnly
    ? parts.filter((part) => !part.specialOrder && part.quantityOnHand <= part.reorderPoint)
    : parts;
}

export async function getPart(partId) {
  requireInventoryConfigured();
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('id', partId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? fromDbPart(data) : null;
}

export async function createPart(shopId = getCurrentShopId(), payload = {}) {
  requireInventoryConfigured();
  const partPayload = toDbPart(shopId, payload);
  if (!partPayload.name) {
    throw new Error('Part name is required.');
  }

  const { data, error } = await supabase
    .from('parts')
    .insert(partPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const createdPart = fromDbPart(data);
  // TODO: Add shop-level audit events when FretTrack has a non-job event table.
  return createdPart;
}

export async function updatePart(partId, payload = {}) {
  requireInventoryConfigured();
  const existingPart = await getPart(partId);
  if (!existingPart) {
    throw new Error('Part not found.');
  }

  const { data, error } = await supabase
    .from('parts')
    .update(toDbPart(existingPart.shopId, { ...existingPart, ...payload }))
    .eq('id', partId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return fromDbPart(data);
}

export async function uploadPartImage(part, file) {
  if (!part?.id || !part?.shopId) {
    throw new Error('Save the part before adding a part image.');
  }
  if (!file) {
    return part;
  }

  const dimensions = await readImageDimensions(file);
  if (dimensions.width > MAX_PART_IMAGE_DIMENSION || dimensions.height > MAX_PART_IMAGE_DIMENSION) {
    throw new Error(`Part image must already be ${MAX_PART_IMAGE_DIMENSION}x${MAX_PART_IMAGE_DIMENSION} px or smaller. This image is ${dimensions.width}x${dimensions.height} px.`);
  }
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Part image must be an image file.');
  }

  if (!hasSupabaseConfig || !supabase) {
    return {
      ...part,
      imagePath: '',
      imageMimeType: file.type || '',
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
      imageUrl: URL.createObjectURL(file)
    };
  }

  const filePath = `${part.shopId}/parts/${part.id}/${Date.now()}-${safeStorageFileName(file.name || 'part-image')}`;
  const requestId = crypto.randomUUID();
  await reservePhotoUsage({
    shopId: part.shopId,
    requestId,
    usageKind: 'source_photo',
    expectedStorageBytes: file.size,
    bucket: PART_IMAGES_BUCKET,
    path: filePath
  });

  let uploaded = false;
  try {
    const { error: uploadError } = await supabase.storage
      .from(PART_IMAGES_BUCKET)
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '31536000'
      });
    if (uploadError) {
      throw uploadError;
    }
    uploaded = true;
    await settlePhotoUsage({ shopId: part.shopId, requestId });
  } catch (error) {
    if (uploaded) {
      await supabase.storage.from(PART_IMAGES_BUCKET).remove([filePath]);
    }
    await releasePhotoUsageReservation({ shopId: part.shopId, requestId }).catch(() => null);
    throw error;
  }

  const { data, error } = await supabase
    .from('parts')
    .update({
      image_path: filePath,
      image_mime_type: file.type || null,
      image_width: dimensions.width,
      image_height: dimensions.height
    })
    .eq('id', part.id)
    .select()
    .single();

  if (error) {
    await removePartImageAndReleaseUsage(part.shopId, filePath);
    throw error;
  }

  if (part.imagePath && part.imagePath !== filePath) {
    await removePartImageAndReleaseUsage(part.shopId, part.imagePath);
  }

  return {
    ...fromDbPart(data),
    imageUrl: await createPartImageObjectUrl(filePath)
  };
}

async function removePartImageAndReleaseUsage(shopId, storagePath) {
  const { error } = await supabase.storage.from(PART_IMAGES_BUCKET).remove([storagePath]);
  if (error) {
    console.error('Part image cleanup failed.', error);
    return;
  }
  try {
    await releaseDeletedPhotoStorage({
      shopId,
      bucket: PART_IMAGES_BUCKET,
      path: storagePath
    });
  } catch (releaseError) {
    console.error('Part image storage usage release failed.', releaseError);
  }
}

export async function createPartImageObjectUrl(storagePath) {
  if (!storagePath || !hasSupabaseConfig || !supabase) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from(PART_IMAGES_BUCKET)
    .download(storagePath);

  if (error) {
    throw error;
  }

  return URL.createObjectURL(data);
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read part image dimensions.'));
    };
    image.src = objectUrl;
  });
}

function safeStorageFileName(fileName) {
  const cleaned = String(fileName || 'part-image')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || 'part-image';
}

export async function deactivatePart(partId) {
  return updatePart(partId, { isActive: false });
}

export async function listVendors(shopId = getCurrentShopId(), filters = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let query = supabase
    .from('vendors')
    .select('*')
    .eq('shop_id', shopId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (filters.activeOnly) {
    query = query.eq('is_active', true);
  }

  const search = cleanText(filters.search);
  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&');
    query = query.or(`name.ilike.%${escaped}%,contact_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,website.ilike.%${escaped}%,city.ilike.%${escaped}%,state.ilike.%${escaped}%,postal_code.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data || []).map(fromDbVendor);
}

export async function createVendor(shopId = getCurrentShopId(), payload = {}) {
  requireInventoryConfigured();
  const vendorPayload = toDbVendor(shopId, payload);
  if (!vendorPayload.name) {
    throw new Error('Vendor name is required.');
  }

  const { data, error } = await supabase
    .from('vendors')
    .insert(vendorPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return fromDbVendor(data);
}

export async function updateVendor(vendorId, payload = {}) {
  requireInventoryConfigured();
  const shopId = payload.shopId || payload.shop_id || getCurrentShopId();
  const vendorPayload = toDbVendor(shopId, payload);
  if (!vendorPayload.name) {
    throw new Error('Vendor name is required.');
  }

  const { data, error } = await supabase
    .from('vendors')
    .update(vendorPayload)
    .eq('id', vendorId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return fromDbVendor(data);
}
