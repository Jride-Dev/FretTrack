import {
  approvalProviderRetryStatus,
  isConfirmedApprovalProviderRejection,
} from './delivery.ts';

Deno.test('only explicit provider rejections release an approval delivery for a new attempt', () => {
  for (const status of [400, 401, 403, 404, 422]) {
    if (!isConfirmedApprovalProviderRejection(status)) {
      throw new Error(`Expected ${status} to be a confirmed rejection.`);
    }
  }

  for (const status of [0, 409, 429, 500, 502, 503, undefined]) {
    if (isConfirmedApprovalProviderRejection(status)) {
      throw new Error(`Expected ${status} to remain retryable with the same provider key.`);
    }
  }
});

Deno.test('concurrent provider retries return conflict while ambiguous failures stay unavailable', () => {
  if (approvalProviderRetryStatus(409) !== 409) throw new Error('Expected provider conflict status.');
  if (approvalProviderRetryStatus(500) !== 503) throw new Error('Expected retryable unavailable status.');
});
