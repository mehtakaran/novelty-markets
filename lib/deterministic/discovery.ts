// Step 1, the deterministic half: just pull items from the three feeds, no judgment yet.
// This mirrors how the trader already checks news, social, and prediction-market trends by
// instinct — we're just automating the "go look" part, not the "is this worth it" part.

import newsHeadlines from "@/data/fixtures/newsHeadlines.json";
import socialTrends from "@/data/fixtures/socialTrends.json";
import trendingPredictionMarkets from "@/data/fixtures/trendingPredictionMarkets.json";
import { existingSourceItemIds } from "@/lib/db";
import { screenForInjectionPatterns } from "@/lib/deterministic/injectionScreen";
import type { RawFeedItem, SourceType } from "@/lib/types";

interface FixtureItem {
  sourceItemId: string;
  headline: string;
  detail: string;
  observedAt: string;
  engagementSignal?: string;
}

function tag(items: FixtureItem[], sourceType: SourceType): RawFeedItem[] {
  return items.map((item) => {
    const injectionFlag = screenForInjectionPatterns(`${item.headline} ${item.detail}`) ?? undefined;
    return { ...item, sourceType, injectionFlag };
  });
}

/**
 * Combines all three feeds into one batch. Skips anything that already produced a candidate
 * in an earlier sweep, so clicking "Run Discovery Sweep" again during a demo doesn't create
 * duplicate rows for the same story.
 */
export function gatherDiscoveryBatch(): RawFeedItem[] {
  const seen = existingSourceItemIds();
  const all = [
    ...tag(newsHeadlines as FixtureItem[], "news"),
    ...tag(socialTrends as FixtureItem[], "social"),
    ...tag(trendingPredictionMarkets as FixtureItem[], "trending_market"),
  ];
  return all.filter((item) => !seen.has(item.sourceItemId));
}
