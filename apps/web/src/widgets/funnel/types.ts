import type { Opportunity, UserAvatar } from "@/lib/api-types";

export type FunnelStage = {
  id: string;
  title: string;
};

export type FunnelDealOwner = UserAvatar;

export type FunnelDeal = Pick<Opportunity, "id" | "title"> &
  Partial<Omit<Opportunity, "id" | "title">> & {
  client: string;
  amount: string;
  stage: string;
  owner: FunnelDealOwner;
};
