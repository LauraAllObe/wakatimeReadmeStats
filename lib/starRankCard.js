import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { parseHours, safeFetchJson } from '../lib/utils.js'; // adjust path as needed

function loadCleanSinglePath(filename, mode, rank_color) {
  rank_color = rank_color.replace(/^#/, '');
  const raw = fs.readFileSync(path.join(process.cwd(), 'static', filename), 'utf-8');
  const match = raw.match(/<path\s+([^>]*)\/?>/i);
  if (!match) throw new Error('No <path> tag');
  let attrs = match[1]
    .replace(/\/$/, '')
    .replace(/\b(?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)\s*=\s*['"][^'"]*['"]/gi, '')
    .trim();

  const colorAttrs = mode === 'fill'
    ? `fill="#${rank_color}"`
    : `stroke="#${rank_color}" fill="none" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"`;

  return `<path ${attrs ? attrs + ' ' : ''}${colorAttrs} />`;
}

function parseTimeTextToSeconds(timeText) {
  const hrMatch = timeText.match(/(\d+)\s*hr[s]?/i);
  const minMatch = timeText.match(/(\d+)\s*min[s]?/i);

  const hours = hrMatch ? parseInt(hrMatch[1], 10) : 0;
  const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;

  return (hours * 3600) + (minutes * 60);
}

export async function getStarRankCard({
  api_key,
  username,
  text_color,
  font_family,
  rank_color,
  hide_title
}) {
  rank_color = rank_color.replace(/^#/, '');
  text_color = text_color.replace(/^#/, '');
  const tierCutoffs = {
    6: [1, 50],
    5: [51, 300],
    4: [301, 1000],
    3: [1001, 2500],
    2: [2501, 5000],
    1: [5001, 8000],
    0: [8001, 10000]
  };
  let current_rank = -1;

  const rhsX = 160, barWidth = 160;
  const starPos = [
    [0,-32],[28,-16],[28,16],[0,32],[-28,16],[-28,-16],[0,0]
  ];
  const rankTitles = ['Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Mythic'];
  const fullStar = loadCleanSinglePath('fullStar.svg', 'fill', rank_color);
  const emptyStar = loadCleanSinglePath('emptyStar.svg', 'stroke', rank_color);

  let tier = 0, level_target = 1, jumps_to_next = 0;
  let tierThresholds = [];
  let level_hours = 0;
  let tier_rank_estimate = 'N/A';
  let isUnranked = false;

  try {
    const apiKey = api_key ?? '';
    if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

    const res = await fetch(
      `https://wakatime.com/api/v1/users/${username}/summaries?range=last_7_days`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
        }
      }
    );

    const json = await res.json();
    const totalTimeText = json.cumulative_total.text;
    const totalSeconds = parseTimeTextToSeconds(totalTimeText);
    level_hours = totalSeconds / 3600;

    const userInfo = await safeFetchJson('https://wakatime.com/api/v1/leaders', {
      Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
    });

    console.log('userInfo:', JSON.stringify(userInfo, null, 2));

    if (userInfo?.current_user?.rank != null) {
      current_rank = userInfo.current_user.rank;
    } else {
      const matchedUser = userInfo?.data?.find(u =>
        u.user?.username?.toLowerCase() === username?.toLowerCase()
      );
      if (matchedUser?.rank != null) {
        current_rank = matchedUser.rank;
      } else {
        console.warn('Could not determine rank via current_user or fallback search. Using default.');
        current_rank = -1;
      }
    }

    const requiredRanks = Object.values(tierCutoffs).flat();
    const requiredPages = [...new Set(requiredRanks.map(rank => Math.floor((rank - 1) / 100) + 1))];

    const pages = await Promise.all(
      requiredPages.map(page =>
        safeFetchJson(`https://wakatime.com/api/v1/leaders?page=${page}`, {
          Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
        }).catch(() => ({ data: [] }))
      )
    );

    const rankMap = new Map();
    pages.forEach(page => {
      page.data.forEach(user => {
        const rank = user.rank;
        const hrt = user.running_total?.human_readable_total;
        if (rank && hrt) {
          rankMap.set(rank, parseHours(hrt));
        }
      });
    });

    tierThresholds = Object.entries(tierCutoffs).reduce((acc, [t, [minR, maxR]]) => {
      const minH = rankMap.get(minR) ?? 0;
      const maxH = rankMap.get(maxR) ?? minH;
      acc[parseInt(t)] = { minR, maxR, minH, maxH };
      return acc;
    }, {});

    const findTier = current_rank >= 1
      ? Object.entries(tierCutoffs).find(([t, [lo, hi]]) => current_rank >= lo && current_rank <= hi)
      : null;

    if (findTier) {
      tier = parseInt(findTier[0]);
    } else {
      // Use level_hours to detect if below tier 0 minimum
      const minHoursBronze = tierThresholds[0]?.minH ?? 0;
      if (level_hours < minHoursBronze) {
        isUnranked = true;
        tier = -1;
      } else {
        tier = 0;
      }
    }

    const nextTier = tier + 1;
    if (tierThresholds[nextTier]) {
      level_target = tierThresholds[nextTier].minH;
    } else {
      level_target = tierThresholds[tier]?.maxH || level_hours;
    }

    jumps_to_next = Math.max(0, level_target - level_hours);
    
    if (isUnranked) {
      level_target = tierThresholds[0]?.minH ?? 1;
      jumps_to_next = Math.max(0, level_target - level_hours);
    }

    // Estimate tier number via binary search if current_rank is undefined or off-leaderboard
    const tierRange = tierCutoffs[tier];
    if (tierRange && level_hours > 0) {
      const [tierMinRank, tierMaxRank] = tierRange;
      // Binary search for estimated rank
      let low = tierMinRank;
      let high = tierMaxRank;
      let candidateRank = tierMaxRank;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midHours = rankMap.get(mid);

        if (midHours == null) {
          high = mid - 1;
          continue;
        }

        if (level_hours > midHours) {
          candidateRank = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }

      tier_rank_estimate = candidateRank;
    }

  } catch (e) {
    console.error('Error computing rank card:', e.message);
  }

  const glowFilter = tier >= 4 ? `
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="${(tier - 3) * 1.5}" />
      </filter>
    </defs>` : '';

  const stars = starPos.map((pos, i) => {
    if (i === 6 && tier !== 6) return '';
    const [dx, dy] = pos;
    const isFull = i <= tier;
    const svg = isFull ? fullStar : emptyStar;
    const glowAttr = tier >= 4 ? `filter="url(#glow)"` : '';
    return `<g transform="translate(${60 + dx},${40 + dy}) scale(0.6)" ${glowAttr}>${svg}</g>`;
  });

  const tt = tier >= 0 ? tierThresholds[tier] : null;
  const progress = level_target > 0 ? Math.min(Math.max(level_hours / level_target, 0), 1) : 1;

  const rankTitle = isUnranked ? 'Unranked' : rankTitles[tier];
  const rangeText = isUnranked ? 'Below 10000' : `${tt?.minR ?? ''}–${tt?.maxR ?? ''}`;
  const rankDisplay = current_rank >= 1 ? current_rank : (isUnranked ? 'Unranked' : tier_rank_estimate);

  const rightContent = `
    <text x="${rhsX}" y="30" fill="#${text_color}" font-family="${font_family}">
      <tspan font-size="11">Rank </tspan>
      <tspan font-size="9">#</tspan>
      <tspan font-size="15" font-weight="bold">${rankDisplay}</tspan>
    </text>
    <text x="${rhsX}" y="50" font-size="11" fill="#${text_color}" font-family="${font_family}">
      ${rankTitle} Tier: ${isUnranked ? rangeText : `<tspan font-size="10">#</tspan>${rangeText}`}
    </text>
    <rect x="${rhsX}" y="65" width="${barWidth}" height="8" fill="#${rank_color}" rx="4" opacity="0.1"/>
    <rect x="${rhsX}" y="65" width="${progress * barWidth}" height="8" fill="#${rank_color}" rx="4"/>
    <text x="${rhsX + barWidth}" y="95" font-size="11" text-anchor="end" fill="#${text_color}" font-family="${font_family}">
      ${isUnranked ? `Reach ${level_target.toFixed(1)} hrs` : `${level_hours.toFixed(1)}/${level_target.toFixed(1)} hrs`}
    </text>`;

  const titleSvg = hide_title
    ? ''
    : `<text x="${(rhsX + barWidth) / 2}" y="25" font-size="16" text-anchor="middle" fill="#${text_color}" font-family="${font_family}" font-weight="bold">Weekly Ranking</text>`;

  const titleOffset = hide_title ? 0 : 35;

  return {
    content: `
      ${glowFilter}
      ${titleSvg}
      <g transform="translate(0, ${titleOffset})">${stars.join('\n')}</g>
      <text x="67.5" y="110" transform="translate(0, ${titleOffset})" font-size="15" text-anchor="middle" fill="#${text_color}" font-family="${font_family}">
        ${rankTitle}
      </text>
      <g transform="translate(0, ${titleOffset})">${rightContent}</g>
    `,
    height: 120 + titleOffset,
    width: rhsX + barWidth + 40
  };
}
