export function isConfirmedApprovalProviderRejection(status: unknown) {
  return [400, 401, 403, 404, 422].includes(Number(status));
}

export function approvalProviderRetryStatus(status: unknown) {
  return Number(status) === 409 ? 409 : 503;
}
