import type { DemoCampaign } from "@/lib/domain/types";

export const demoCampaigns: DemoCampaign[] = [
  {
    id: "shinsaibashi-yakiniku-001",
    restaurantName: "焼肉 GOURMET LAB",
    title: "黒毛和牛コース リールPR募集",
    area: "心斎橋",
    category: "焼肉",
    cashReward: 6000,
    foodOffer: "2名までコース提供",
    maxCompanions: 1,
    creatorSlots: 3,
    platforms: ["instagram_reel"],
    visitPeriod: "10/8〜10/14",
    slots: [
      { id: "s1", dateLabel: "10月8日（水）", startsAt: "2026-10-08T18:00:00+09:00", timeLabel: "18:00", remaining: 1, isOpen: true },
      { id: "s2", dateLabel: "10月8日（水）", startsAt: "2026-10-08T18:30:00+09:00", timeLabel: "18:30", remaining: 1, isOpen: true },
      { id: "s3", dateLabel: "10月8日（水）", startsAt: "2026-10-08T19:00:00+09:00", timeLabel: "19:00", remaining: 1, isOpen: true },
      { id: "s4", dateLabel: "10月8日（水）", startsAt: "2026-10-08T19:30:00+09:00", timeLabel: "19:30", remaining: 1, isOpen: true },
      { id: "s5", dateLabel: "10月8日（水）", startsAt: "2026-10-08T20:00:00+09:00", timeLabel: "20:00", remaining: 0, isOpen: false },
      { id: "s6", dateLabel: "10月8日（水）", startsAt: "2026-10-08T20:30:00+09:00", timeLabel: "20:30", remaining: 1, isOpen: true },

      { id: "s7", dateLabel: "10月9日（木）", startsAt: "2026-10-09T18:00:00+09:00", timeLabel: "18:00", remaining: 1, isOpen: true },
      { id: "s8", dateLabel: "10月9日（木）", startsAt: "2026-10-09T18:30:00+09:00", timeLabel: "18:30", remaining: 1, isOpen: true },
      { id: "s9", dateLabel: "10月9日（木）", startsAt: "2026-10-09T19:00:00+09:00", timeLabel: "19:00", remaining: 1, isOpen: true },
      { id: "s10", dateLabel: "10月9日（木）", startsAt: "2026-10-09T19:30:00+09:00", timeLabel: "19:30", remaining: 1, isOpen: true },
      { id: "s11", dateLabel: "10月9日（木）", startsAt: "2026-10-09T20:00:00+09:00", timeLabel: "20:00", remaining: 1, isOpen: true },
      { id: "s12", dateLabel: "10月9日（木）", startsAt: "2026-10-09T20:30:00+09:00", timeLabel: "20:30", remaining: 0, isOpen: false },

      { id: "s13", dateLabel: "10月11日（土）", startsAt: "2026-10-11T18:00:00+09:00", timeLabel: "18:00", remaining: 1, isOpen: true },
      { id: "s14", dateLabel: "10月11日（土）", startsAt: "2026-10-11T18:30:00+09:00", timeLabel: "18:30", remaining: 1, isOpen: true },
      { id: "s15", dateLabel: "10月11日（土）", startsAt: "2026-10-11T19:00:00+09:00", timeLabel: "19:00", remaining: 1, isOpen: true },
      { id: "s16", dateLabel: "10月11日（土）", startsAt: "2026-10-11T19:30:00+09:00", timeLabel: "19:30", remaining: 0, isOpen: false },
      { id: "s17", dateLabel: "10月11日（土）", startsAt: "2026-10-11T20:00:00+09:00", timeLabel: "20:00", remaining: 1, isOpen: true },
      { id: "s18", dateLabel: "10月11日（土）", startsAt: "2026-10-11T20:30:00+09:00", timeLabel: "20:30", remaining: 0, isOpen: false }
    ]
  },
  {
    id: "umeda-sushi-002",
    restaurantName: "鮨 PR LAB",
    title: "おまかせ握りコース PR",
    area: "梅田",
    category: "鮨",
    cashReward: 7000,
    foodOffer: "2名までコース提供",
    maxCompanions: 1,
    creatorSlots: 2,
    platforms: ["instagram_reel", "tiktok"],
    visitPeriod: "10/15〜10/31",
    slots: []
  }
];

export function getDemoCampaign(id: string) {
  return demoCampaigns.find((campaign) => campaign.id === id);
}
