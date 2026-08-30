import { getCurrentShopId } from '../shops/shopConfig';
import {
  listParts as listPartsFromModule,
  getPart as getPartFromModule,
  createPart as createPartFromModule,
  updatePart as updatePartFromModule,
  uploadPartImage as uploadPartImageFromModule,
  createPartImageObjectUrl as createPartImageObjectUrlFromModule,
  deactivatePart as deactivatePartFromModule,
  listVendors as listVendorsFromModule,
  createVendor as createVendorFromModule,
  updateVendor as updateVendorFromModule
} from './inventoryServiceCatalog.js';
import {
  listPurchaseOrders as listPurchaseOrdersFromModule,
  listJobPurchaseOrders as listJobPurchaseOrdersFromModule,
  createPurchaseOrder as createPurchaseOrderFromModule,
  updatePurchaseOrderStatus as updatePurchaseOrderStatusFromModule,
  createSpecialistPurchaseOrder as createSpecialistPurchaseOrderFromModule,
  fulfillSpecialistPurchaseOrderItem as fulfillSpecialistPurchaseOrderItemFromModule
} from './inventoryServicePurchasing.js';
import {
  receivePart as receivePartFromModule,
  receivePurchaseOrderItems as receivePurchaseOrderItemsFromModule,
  fixMissingPartBarcodeCode as fixMissingPartBarcodeCodeFromModule,
  adjustPart as adjustPartFromModule,
  addPartToJob as addPartToJobFromModule,
  updateInventoryJobPartQuantity as updateInventoryJobPartQuantityFromModule,
  addManualPartToJob as addManualPartToJobFromModule,
  removeJobPart as removeJobPartFromModule
} from './inventoryServiceReceiving.js';
import {
  listJobParts as listJobPartsFromModule,
  listPartMovements as listPartMovementsFromModule,
  listPartPurchaseHistory as listPartPurchaseHistoryFromModule,
  listPurchaseHistory as listPurchaseHistoryFromModule
} from './inventoryServiceHistory.js';

export function listParts(shopId = getCurrentShopId(), filters = {}) {
  return listPartsFromModule(shopId, filters);
}

export function getPart(partId) {
  return getPartFromModule(partId);
}

export function createPart(shopId = getCurrentShopId(), payload = {}) {
  return createPartFromModule(shopId, payload);
}

export function updatePart(partId, payload = {}) {
  return updatePartFromModule(partId, payload);
}

export function uploadPartImage(part, file) {
  return uploadPartImageFromModule(part, file);
}

export function createPartImageObjectUrl(storagePath) {
  return createPartImageObjectUrlFromModule(storagePath);
}

export function deactivatePart(partId) {
  return deactivatePartFromModule(partId);
}

export function listVendors(shopId = getCurrentShopId(), filters = {}) {
  return listVendorsFromModule(shopId, filters);
}

export function createVendor(shopId = getCurrentShopId(), payload = {}) {
  return createVendorFromModule(shopId, payload);
}

export function updateVendor(vendorId, payload = {}) {
  return updateVendorFromModule(vendorId, payload);
}

export function listPurchaseOrders(shopId = getCurrentShopId()) {
  return listPurchaseOrdersFromModule(shopId);
}

export function listJobPurchaseOrders(jobId) {
  return listJobPurchaseOrdersFromModule(jobId);
}

export function createSpecialistPurchaseOrder(jobId, payload = {}) {
  return createSpecialistPurchaseOrderFromModule(jobId, payload);
}

export function fulfillSpecialistPurchaseOrderItem(purchaseOrderItemId) {
  return fulfillSpecialistPurchaseOrderItemFromModule(purchaseOrderItemId);
}

export function createPurchaseOrder(shopId = getCurrentShopId(), payload = {}) {
  return createPurchaseOrderFromModule(shopId, payload);
}

export function updatePurchaseOrderStatus(purchaseOrderId, status) {
  return updatePurchaseOrderStatusFromModule(purchaseOrderId, status);
}

export function receivePart(partId, quantity, cost, note = '') {
  return receivePartFromModule(partId, quantity, cost, note);
}

export function receivePurchaseOrderItems(purchaseOrderId, items = [], note = '') {
  return receivePurchaseOrderItemsFromModule(purchaseOrderId, items, note);
}

export function fixMissingPartBarcodeCode(part) {
  return fixMissingPartBarcodeCodeFromModule(part);
}

export function adjustPart(partId, quantityDelta, note = '') {
  return adjustPartFromModule(partId, quantityDelta, note);
}

export function addPartToJob(jobId, partId, quantity = 1) {
  return addPartToJobFromModule(jobId, partId, quantity);
}

export function updateInventoryJobPartQuantity(jobPartId, quantity) {
  return updateInventoryJobPartQuantityFromModule(jobPartId, quantity);
}

export function addManualPartToJob(jobId, payload = {}) {
  return addManualPartToJobFromModule(jobId, payload);
}

export function removeJobPart(jobPartId) {
  return removeJobPartFromModule(jobPartId);
}

export function listJobParts(jobId) {
  return listJobPartsFromModule(jobId);
}

export function listPartMovements(partId) {
  return listPartMovementsFromModule(partId);
}

export function listPartPurchaseHistory(partId) {
  return listPartPurchaseHistoryFromModule(partId);
}

export function listPurchaseHistory(options = {}) {
  return listPurchaseHistoryFromModule(options);
}
