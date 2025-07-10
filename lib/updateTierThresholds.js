// updateTierThresholds.js
import fs from 'fs';
import path from 'path';
import { safeFetchJson, parseHours } from './utils'; // move common helpers to utils.js
import dotenv from 'dotenv';
dotenv.config();

const TIER_CUTOFFS = {
  6: [1, 50],
  5: [51, 300],
  4: [301, 1000],
  3: [1001, 2500],
  2: [2501, 5000],
  1: [5001, 8000],
  0: [8001, 10000]
};

async function fetchAndCacheThresholds() {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

  const requiredRanks = Object.values(TIER_CUTOFFS).flat();
  const requiredPages = [...new Set(requiredRanks.map(rank => Math.floor((rank - 1) / 100) + 1))];
  const pages = requiredPages.map(page =>
    safeFetchJson(`https://wakatime.com/api/v1/leaders?page=${page}`).catch(err => {
      console.error(`Failed to fetch page ${page}: ${err.message}`);
      return { data: [] };
    })
  );

  const leadersData = await Promise.all(pages);
  const rankMap = new Map();

  leadersData.forEach(page => {
    page.data.forEach(user => {
      const rank = user.rank;
      const hrt = user.running_total?.human_readable_total;
      if (rank && hrt) {
        rankMap.set(rank, parseHours(hrt));
      }
    });
  });

  const thresholds = Object.entries(TIER_CUTOFFS).reduce((acc, [t, [minR, maxR]]) => {
    const minH = rankMap.get(minR) ?? 0;
    const maxH = rankMap.get(maxR) ?? minH;
    acc[parseInt(t)] = { minR, maxR, minH, maxH };
    return acc;
  }, {});

  const cachePath = path.join(process.cwd(), 'cache', 'tierThresholds.json');
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(thresholds, null, 2));
  console.log(`✅ Updated tier thresholds at ${cachePath}`);
}

fetchAndCacheThresholds().catch(err => {
  console.error(`❌ Error updating thresholds: ${err.message}`);
});
