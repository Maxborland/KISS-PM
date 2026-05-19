export function isFinalOpportunityStatus(status: string): boolean {
  return status === "converted" || status === "rejected";
}
