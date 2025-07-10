import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { parseHours, safeFetchJson } from '../lib/utils.js'; // adjust path as needed
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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
  username,
  text_color,
  font_family,
  rank_color,
  hide_title
}) {
  const tierCutoffs = {
    6: [1, 50],
    5: [51, 300],
    4: [301, 1000],
    3: [1001, 2500],
    2: [2501, 5000],
    1: [5001, 8000],
    0: [8001, 10000]
  };
  let current_rank;

  const rhsX = 160, barWidth = 160;
  const starPos = [
    [0,-32],[28,-16],[28,16],[0,32],[-28,16],[-28,-16],[0,0]
  ];
  const rankTitles = ['Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Mythic'];
  const fullStar = loadCleanSinglePath('fullStar.svg', 'fill', rank_color);
  const emptyStar = loadCleanSinglePath('emptyStar.svg', 'stroke', rank_color);

  let tier = 0, level_target = 0, jumps_to_next = 0;
  let tierThresholds = [];
  let level_hours = 0;

  try {
    const apiKey = process.env.WAKATIME_API_KEY;
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

    // Leaderboard fetching
    try {
      const data = await redis.get('tierThresholds');
      if (data && typeof data === 'object') {
        tierThresholds = data;
        console.log('✅ Loaded tier thresholds from Redis');
      } else {
        console.warn('⚠️ Tier thresholds not found in Redis');
        tierThresholds = [];
      }
    } catch (err) {
      console.error('❌ Redis fetch error:', err.message);
      tierThresholds = [];
    }

    // Retrieve the current user's rank from the leaders API
    const userInfo = await safeFetchJson('https://wakatime.com/api/v1/leaders', {
      Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
    });

    if (typeof current_rank === 'undefined' && userInfo?.current_user?.rank) {
      current_rank = userInfo.current_user.rank;
      //console.log(`✅ Set current_rank from API: ${current_rank}`);
    } else {
      //console.log(`ℹ️ Using provided current_rank: ${current_rank}`);
    }

    const findTier = Object.entries(tierCutoffs)
      .find(([t, [lo, hi]]) => current_rank >= lo && current_rank <= hi);
    tier = parseInt(findTier?.[0]) ?? 0;

    const nextTier = tier + 1;
    if (tierThresholds[nextTier]) {
      level_target = tierThresholds[nextTier].minH;
    } else {
      // Already at max tier (Mythic), use current tier max as a fallback
      level_target = tierThresholds[tier]?.maxH || level_hours;
    }

    jumps_to_next = Math.max(0, level_target - level_hours);
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
    if (i === 6 && tier !== 6) return ''; // hide 7th star unless Mythic
    const [dx, dy] = pos;
    const isFull = i <= tier;
    const svg = isFull ? fullStar : emptyStar;
    const glowAttr = tier >= 4 ? `filter="url(#glow)"` : '';
    return `<g transform="translate(${60 + dx},${40 + dy}) scale(0.6)" ${glowAttr}>${svg}</g>`;
  });

  const tt = tierThresholds[tier];
  const rangeText = tt ? `${tt.minR}–${tt.maxR}` : 'N/A';

  const rightContent = `
    <text x="${rhsX}" y="30" fill="#${text_color}" font-family="${font_family}">
      <tspan font-size="11">Rank </tspan><tspan font-size="9">#</tspan><tspan font-size="15" font-weight="bold">${current_rank}</tspan>
    </text>
    <text x="${rhsX}" y="50" font-size="11" fill="#${text_color}" font-family="${font_family}">
      ${rankTitles[tier]} Tier: <tspan font-size="10">#</tspan>${rangeText}
    </text>
    <rect x="${rhsX}" y="65" width="${barWidth}" height="8" fill="#${rank_color}" rx="4" opacity="0.1"/>
    <rect x="${rhsX}" y="65" width="${Math.min(Math.max(level_hours / level_target, 0), 1) * barWidth}" height="8" fill="#${rank_color}" rx="4"/>
    <text x="${rhsX + barWidth}" y="95" font-size="11" text-anchor="end" fill="#${text_color}" font-family="${font_family}">
      ${level_hours.toFixed(1)}/${level_target.toFixed(1)} hrs
    </text>`;

    const titleSvg = hide_title
      ? ''
      : `<text x="${(rhsX + barWidth) / 2}" y="25" font-size="16" text-anchor="middle" fill="#${text_color}" font-family="${font_family}" font-weight="bold">Weekly Ranking</text>`;

    const titleOffset = hide_title ? 0 : 35; // or 30 if needed

  return {
    content: `
      ${glowFilter}
      ${titleSvg}
      <g transform="translate(0, ${titleOffset})">${stars.join('\n')}</g>
      <text x="67.5" y="110" transform="translate(0, ${titleOffset})" font-size="15" text-anchor="middle" fill="#${text_color}" font-family="${font_family}">
        ${rankTitles[tier]}
      </text>
      <g transform="translate(0, ${titleOffset})">${rightContent}</g>
    `,
    height: 120 + titleOffset,
    width: rhsX + barWidth + 40
  };
}
