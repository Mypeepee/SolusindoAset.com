import type { CSSProperties } from "react";
import type { CampaignPeriod } from "@/lib/marketing/campaign";

// Widely spaced hues; patterns and a unique reference also distinguish reused hues.
const hues = [38, 260, 200, 340, 165, 18, 80, 225, 305, 135, 55, 185];
const patterns = ["solid", "stripe", "dot"] as const;
type Campaign = NonNullable<CampaignPeriod["plan"]>;

export function plannerCampaignAppearance(campaign: Campaign) {
  let hash = 2166136261;
  for (const character of campaign.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const stored = Number.isSafeInteger(campaign.appearanceIndex) && campaign.appearanceIndex! >= 0;
  const index = stored ? campaign.appearanceIndex! : hash >>> 0;
  const hue = hues[index % hues.length];
  const pattern = patterns[Math.floor(index / hues.length) % patterns.length];
  return {
    code: stored ? `C${index + 1}` : `C${(hash >>> 0).toString(36).slice(-3).toUpperCase()}`,
    pattern,
    style: {
      "--planner-campaign-bg": `hsl(${hue} 28% 14%)`,
      "--planner-campaign-hover": `hsl(${hue} 30% 18%)`,
      "--planner-campaign-selected": `hsl(${hue} 32% 21%)`,
      "--planner-campaign-line": `hsl(${hue} 65% 70% / 0.3)`,
      "--planner-campaign-ink": `hsl(${hue} 78% 84%)`,
      "--planner-campaign-accent": `hsl(${hue} 72% 70%)`,
      "--planner-campaign-ribbon": `hsl(${hue} 58% 65% / 0.13)`,
    } as CSSProperties,
  };
}
