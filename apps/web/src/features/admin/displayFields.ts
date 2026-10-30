/** Hide system relationships and storage/provider metadata, without rewriting customer-authored values. */
export function isInternalAdminField(key: string) {
  return key === "_id" || key === "id" || /(?:Id|Ids|_id|_ids)$/.test(key) || /^(?:objectKey|bucket|outputBucket|outputObjectKey|checksum|sha256|configurationHash|fingerprint|providerRequestId|requestId|operationKey|idempotencyKey|leaseOwner|leaseExpiresAt|token|secret)$/i.test(key);
}
export function visibleAdminRecord(row: Record<string, unknown>) {
  const fields = ["name", "title", "email", "customerName", "customerEmail", "campaignTitle", "templateName", "status", "kind", "mode", "category", "description", "createdAt", "updatedAt", "completedAt", "amountMinor", "credits", "delta", "balanceAfter", "reason", "providerReference", "refundStatus", "revision", "value", "subject", "priority", "action", "outcome", "rowCount"];
  return Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
}
export function visibleAdminRelated(row: Record<string, unknown>) {
  const fields = ["wallet", "payments", "refunds", "versions", "media", "references", "approval", "revisions", "messages", "events"];
  return Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
}
