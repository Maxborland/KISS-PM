export function isFinalOpportunityStatus(status: string): boolean {
  return status === "won_closed" || status === "lost_rejected";
}
