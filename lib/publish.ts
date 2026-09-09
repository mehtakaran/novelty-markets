// Step 5: the mocked "goes live" stub. Deliberately simple — the brief is explicit that a
// real publishing integration isn't the point here, and most of the build effort should go
// elsewhere. The one rule that matters: this is the only function that ever creates a
// live_markets row, and it only ever runs after a trader has actually approved something
// (see candidateWorkflow in temporal/workflows.ts).

import { insertLiveMarket } from "@/lib/db";
import type { LiveMarketRow } from "@/lib/types";

export async function publishMarket(input: {
  candidateId: string;
  marketQuestion: string;
  category: string;
  price: number;
}): Promise<LiveMarketRow> {
  // Stands in for a real publish call to the trading platform (would be an HTTP request).
  await new Promise((resolve) => setTimeout(resolve, 50));

  return insertLiveMarket({
    candidateId: input.candidateId,
    marketQuestion: input.marketQuestion,
    category: input.category,
    ourPrice: input.price,
    publishedAt: new Date().toISOString(),
  });
}
