export type Platform =
  | "instagram_feed"
  | "instagram_reel"
  | "instagram_story"
  | "tiktok"
  | "youtube_shorts"
  | "ugc_photo"
  | "ugc_video";

export type CampaignStatus =
  | "draft"
  | "published"
  | "recruiting"
  | "filled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "suspended";

export type CampaignSlot = {
  id: string;
  dateLabel: string;
  startsAt: string;
  timeLabel: string;
  remaining: number;
  isOpen: boolean;
};

export type DemoCampaign = {
  id: string;
  restaurantName: string;
  title: string;
  area: string;
  category: string;
  cashReward: number;
  foodOffer: string;
  maxCompanions: number;
  creatorSlots: number;
  visibility?: "public" | "direct";
  platforms: Platform[];
  visitPeriod: string;
  slots: CampaignSlot[];
};
