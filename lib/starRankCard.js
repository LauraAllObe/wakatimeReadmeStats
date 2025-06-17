import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

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

function parseHours(humanTime) {
  const [hrsStr, minsStr] = humanTime.split('hrs');
  const hours = parseFloat(hrsStr?.trim()) || 0;
  const minutes = parseFloat(minsStr?.replace('mins', '').trim()) || 0;
  return hours + minutes / 60;
}

function safeFetchJson(url, headers = {}, timeout = 10000) {
  return Promise.race([
    fetch(url, { headers }).then(res => res.json()),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeout))
  ]);
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
  text_color = '333333',
  font_family = 'Calibri',
  rank_color = 'f5dd42'
}) {
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
    const requiredRanks = [1, 10, 11, 100, 101, 500, 501, 1500, 1501, 3000, 3001, 5000, 5001, 10000];
    const requiredPages = [...new Set(requiredRanks.map(rank => Math.floor((rank - 1) / 100) + 1))];

    const pages = requiredPages.map(page =>
      safeFetchJson(`https://wakatime.com/api/v1/leaders?page=${page}`).catch(err => {
        console.error(`Failed to fetch page ${page}: ${err.message}`);
        return { data: [] };
      })
    );

    const leadersData = await Promise.all(pages);

    // Map rank -> hours
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

    const tierCutoffs = {
      6: [1, 10],       // Mythic
      5: [11, 100],     // Ascendant
      4: [101, 500],    // Diamond
      3: [501, 1500],   // Platinum
      2: [1501, 3000],  // Gold
      1: [3001, 5000],  // Silver
      0: [5001, 10000]  // Bronze
    };

    tierThresholds = Object.entries(tierCutoffs).reduce((acc, [t, [minR, maxR]]) => {
      const minH = rankMap.get(minR) ?? 0;
      const maxH = rankMap.get(maxR) ?? minH;
      acc[parseInt(t)] = { minR, maxR, minH, maxH };
      return acc;
    }, []);

    // Retrieve the current user's rank from the leaders API
    const userInfo = await safeFetchJson('https://wakatime.com/api/v1/leaders', {
      Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
    });

    if ((typeof current_rank === 'undefined' || prefer_api_rank) && userInfo?.current_user?.rank) {
      current_rank = userInfo.current_user.rank;
      console.log(`✅ Set current_rank from API: ${current_rank}`);
    } else {
      console.log(`ℹ️ Using provided current_rank: ${current_rank}`);
    }

    const findTier = Object.entries(tierCutoffs)
      .find(([t, [lo, hi]]) => current_rank >= lo && current_rank <= hi);
    tier = parseInt(findTier?.[0]) ?? 0;

    const th = tierThresholds[tier];
    if (!th) throw new Error(`Missing thresholds for tier ${tier}`);

    level_target = th.maxH;
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

  const tt = tierThresholds[tier] ?? { minR: 0, maxR: 0 };
  const rangeText = `${tt.minR}–${tt.maxR}`;

  const rightContent = `
    <text x="${rhsX}" y="30" fill="#${text_color}" font-family="${font_family}">
      <tspan font-size="11">Rank </tspan><tspan font-size="9">#</tspan><tspan font-size="15" font-weight="bold">${current_rank}</tspan>
    </text>
    <text x="${rhsX}" y="50" font-size="11" fill="#${text_color}" font-family="${font_family}">
      ${rankTitles[tier]} Tier: <tspan font-size="10">#</tspan>${rangeText}
    </text>
    <rect x="${rhsX}" y="65" width="${barWidth}" height="8" fill="#ccc" rx="4"/>
    <rect x="${rhsX}" y="65" width="${Math.min(level_hours / level_target, 1) * barWidth}" height="8" fill="#${text_color}" rx="4"/>
    <text x="${rhsX + barWidth}" y="95" font-size="11" text-anchor="end" fill="#${text_color}" font-family="${font_family}">
      ${level_hours.toFixed(1)}/${level_target.toFixed(1)} hrs
    </text>`;

  return {
    content: `
      ${glowFilter}
      <g>${stars.join('\n')}</g>
      <text x="67.5" y="110" font-size="15" text-anchor="middle" fill="#${text_color}" font-family="${font_family}">
        ${rankTitles[tier]}
      </text>
      <g>${rightContent}</g>
    `,
    height: 120,
    width: rhsX + barWidth + 40
  };
}
