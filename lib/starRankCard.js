import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { parseHours, safeFetchJson } from '../lib/utils.js'; // adjust path as needed
import calculateRank, { getMedians } from '../api/calculateRank.js';

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

const iconCache = new Map();
function loadIcon(name, rank_color) {
  const key = `${name}-${rank_color}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const filePath = path.join(process.cwd(), 'static', 'icons', `${name}.svg`);
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512';
  const [, , vbWidthStr, vbHeightStr] = viewBox.split(' ');
  const vbWidth = parseFloat(vbWidthStr || '512');
  const vbHeight = parseFloat(vbHeightStr || '512');

  const inner = raw
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<svg[^>]*>/i, '')
    .replace(/<\/svg>/i, '');

  const colored = inner
    .replace(/currentColor/gi, `#${rank_color}`)
    .replace(/stroke="[^"]*"/gi, (m) => m.includes('none') ? m : `stroke="#${rank_color}"`)
    .replace(/fill="currentColor"/gi, `fill="#${rank_color}"`);

  const icon = { body: colored, vbWidth, vbHeight };
  iconCache.set(key, icon);
  return icon;
}

// Competitive at the top, easier ramp at the bottom. Progression tightens as you climb.
const GITHUB_TIER_THRESHOLDS = [
  { tier: 6, maxPercentile: 1 },   // Mythic: top 1%
  { tier: 5, maxPercentile: 10 },  // Ascendant: top 10%
  { tier: 4, maxPercentile: 30 },  // Diamond: top 30%
  { tier: 3, maxPercentile: 55 },  // Platinum: top 55%
  { tier: 2, maxPercentile: 75 },  // Gold: top 75%
  { tier: 1, maxPercentile: 90 },  // Silver: top 90%
  { tier: 0, maxPercentile: 100 }  // Bronze: everyone else
];

function mapGithubPercentileToTier(percentile) {
  const match = GITHUB_TIER_THRESHOLDS.find(entry => percentile <= entry.maxPercentile)
    ?? GITHUB_TIER_THRESHOLDS[GITHUB_TIER_THRESHOLDS.length - 1];
  const next = GITHUB_TIER_THRESHOLDS.find(entry => entry.tier === match.tier + 1);
  return { current: match, next };
}

async function fetchGithubStats(username, githubToken) {
  if (!githubToken) {
    throw new Error('Missing GITHUB_TOKEN for GitHub rank calculation');
  }

  let baseUser = null;
  let stars = 0;
  let hasNextPage = true;
  let cursor = null;

  const query = `
    query userStats($login: String!, $after: String) {
      user(login: $login) {
        followers { totalCount }
        repositoriesContributedTo(contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, PULL_REQUEST_REVIEW], first: 1) {
          totalCount
        }
        contributionsCollection {
          totalCommitContributions
          restrictedContributionsCount
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
        }
        repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, first: 100, after: $after) {
          nodes { stargazerCount }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  while (hasNextPage) {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${githubToken}`
      },
      body: JSON.stringify({ query, variables: { login: username, after: cursor } })
    });

    const json = await response.json();

    if (json.errors?.length) {
      const message = json.errors.map(e => e.message).join('; ');
      throw new Error(message || 'GitHub GraphQL error');
    }

    const user = json.data?.user;
    if (!user) {
      throw new Error('GitHub user not found');
    }

    if (!baseUser) {
      baseUser = user;
    }

    user.repositories?.nodes?.forEach(repo => {
      stars += repo?.stargazerCount ?? 0;
    });

    hasNextPage = user.repositories?.pageInfo?.hasNextPage;
    cursor = user.repositories?.pageInfo?.endCursor;
  }

  const cc = baseUser?.contributionsCollection || {};
  return {
    commits: (cc.totalCommitContributions ?? 0) + (cc.restrictedContributionsCount ?? 0),
    prs: cc.totalPullRequestContributions ?? 0,
    issues: cc.totalIssueContributions ?? 0,
    reviews: cc.totalPullRequestReviewContributions ?? 0,
    repos: baseUser?.repositoriesContributedTo?.totalCount ?? 0,
    stars,
    followers: baseUser?.followers?.totalCount ?? 0
  };
}

export async function getStarRankCard({
  api_key,
  github_token,
  default_source,
  mode = 'level',
  username,
  text_color,
  font_family,
  rank_color,
  hide_title,
  show_icons,
}) {
  rank_color = rank_color.replace(/^#/, '');
  text_color = text_color.replace(/^#/, '');
  const cardMode = (default_source?.toLowerCase() === 'waka' && mode !== 'level') ? 'level' : mode;
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
  let progressBarWidth = cardMode === 'progress' ? barWidth + 30 : barWidth;
  progressBarWidth += show_icons ? 35 : 0;
  const starPos = [
    [0,-32],[28,-16],[28,16],[0,32],[-28,16],[-28,-16],[0,0]
  ];
  const rankTitles = ['Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Mythic'];
  const fullStar = loadCleanSinglePath('fullStar.svg', 'fill', rank_color);
  const emptyStar = loadCleanSinglePath('emptyStar.svg', 'stroke', rank_color);

  let tier = 0;
  let level_target = 1;
  let level_value = 0;
  let tierThresholds = [];
  let tier_rank_estimate = 'N/A';
  let isUnranked = false;
  let rankTitle = 'Unranked';
  let rangeText = '';
  let rankDisplay = 'N/A';
  let progress = 0;
  let githubTierInfo = null;
  let activeSourceGithubStats = null;
  const hasGithubToken = !!(github_token || process.env.GITHUB_TOKEN);
  let sourcePref = (default_source ?? (hasGithubToken ? 'combo' : 'waka')).toLowerCase();

  if (!hasGithubToken) {
    sourcePref = 'waka';
  } else if (sourcePref === 'combo') {
    sourcePref = 'github';
  }

  let activeSource = sourcePref === 'github' ? 'github' : 'waka';

  if (activeSource === 'github') {
    try {
      const stats = await fetchGithubStats(username, github_token || process.env.GITHUB_TOKEN || '');
      const rankResult = calculateRank({ all_commits: true, ...stats });
      const percentile = rankResult.percentile;
      const score = Math.max(0, 100 - percentile);
      githubTierInfo = mapGithubPercentileToTier(percentile);
      tier = githubTierInfo.current.tier;
      rankTitle = rankTitles[tier];
      rangeText = `&lt;= ${githubTierInfo.current.maxPercentile}%`;
      const targetScore = githubTierInfo.next ? 100 - githubTierInfo.next.maxPercentile : score || 1;
      level_target = targetScore;
      level_value = score;
      progress = targetScore > 0 ? Math.min(score / targetScore, 1) : 1;
      rankDisplay = `${percentile.toFixed(1)}%`;
      activeSource = 'github';
      activeSourceGithubStats = { ...stats, percentile };
    } catch (err) {
      console.error('GitHub rank calculation failed, falling back to WakaTime:', err.message);
      activeSource = 'waka';
    }
  }

  if (activeSource === 'waka') {
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
      const level_hours = totalSeconds / 3600;
      level_value = level_hours;

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

      if (isUnranked) {
        level_target = tierThresholds[0]?.minH ?? 1;
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

      const tt = tier >= 0 ? tierThresholds[tier] : null;
      progress = level_target > 0 ? Math.min(Math.max(level_hours / level_target, 0), 1) : 1;
      rankTitle = isUnranked ? 'Unranked' : rankTitles[tier];
      rangeText = isUnranked ? 'Below 10000' : `${tt?.minR ?? ''}-${tt?.maxR ?? ''}`;
      rankDisplay = current_rank >= 1 ? current_rank : (isUnranked ? 'Unranked' : tier_rank_estimate);
    } catch (e) {
      console.error('Error computing rank card:', e.message);
      isUnranked = true;
      tier = -1;
      rankTitle = 'Unranked';
      rangeText = 'Unavailable';
      rankDisplay = 'N/A';
      level_target = 1;
      level_value = 0;
      progress = 0;
    }
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

  const isGithubSource = activeSource === 'github';
  const formatNum = (n) => (n === null || n === undefined) ? 'N/A' : Number(n).toLocaleString('en-US');

  const computePercentile = (statsObj) => calculateRank({ all_commits: true, ...statsObj }).percentile;
  const renderTwoColumnLines = (lines, yStart = 35, rowHeight = 22, withIcons = false) => {
    const iconPad = withIcons ? 18 : 0;
    const colWidth = 110 + iconPad;
    const split = Math.ceil(lines.length / 2);
    return lines.map((line, idx) => {
      const col = idx >= split ? 1 : 0;
      const row = col ? idx - split : idx;
      const x = rhsX + col * (colWidth + 10);
      const y = yStart + row * rowHeight;
      const icon = withIcons && line.icon ? loadIcon(line.icon, rank_color) : null;
      const iconScale = icon ? (12 / Math.max(icon.vbWidth, icon.vbHeight)) : 0;
      const iconMarkup = icon ? `<g transform="translate(${x},${y - 10}) scale(${iconScale})" fill="#${rank_color}" stroke="#${rank_color}">${icon.body}</g>` : '';
      const textX = x + (icon ? 18 : 0);
      const labelPart = line.label ? `<tspan font-weight="bold">${line.label}</tspan>` : '';
      const spacer = line.label && line.value ? ' ' : '';
      const valuePart = line.value ?? '';
      const text = `<text x="${textX}" y="${y}" font-size="12" fill="#${text_color}" font-family="${font_family}">${labelPart}${spacer}${valuePart}</text>`;
      return `${iconMarkup}${text}`;
    }).join('\n');
  };

  const targetPercentile = githubTierInfo?.next?.maxPercentile ?? null;
  let progressPlan = null;
  if (isGithubSource && cardMode === 'progress' && activeSourceGithubStats && targetPercentile !== null) {
    const medians = getMedians(true); // we always pass all_commits: true
    const metricOrder = ['reviews', 'repos', 'followers', 'issues', 'prs', 'stars', 'commits'];
    const sortedMetrics = [...metricOrder].sort((a, b) => medians[a] - medians[b]);
    const labels = {
      repos: 'Repos',
      commits: 'Commits',
      prs: 'PRs',
      issues: 'Issues',
      reviews: 'Reviews',
      stars: 'Stars',
      followers: 'Followers'
    };

    const working = { ...activeSourceGithubStats };
    const added = sortedMetrics.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    const MAX_STEPS = 20000;
    let iterations = 0;
    let currentPercentile = computePercentile(working);

    if (currentPercentile <= targetPercentile) {
      progressPlan = { added };
    } else {
      // Greedily add +1 to the lowest-median metric that moves percentile the most until we hit the target.
      while (currentPercentile > targetPercentile && iterations < MAX_STEPS) {
        let bestKey = null;
        let bestPct = currentPercentile;

        for (const key of sortedMetrics) {
          const trialPct = computePercentile({ ...working, [key]: (working[key] ?? 0) + 1 });
          if (trialPct < bestPct) {
            bestPct = trialPct;
            bestKey = key;
          }
        }

        if (!bestKey) {
          break;
        }

        working[bestKey] = (working[bestKey] ?? 0) + 1;
        added[bestKey] += 1;
        currentPercentile = bestPct;
        iterations += 1;
      }

      const reached = currentPercentile <= targetPercentile;
      const capped = !reached;
      progressPlan = { added, reached, capped };
    }
  }

  const progressText = isGithubSource
    ? (githubTierInfo?.next
      ? `Rank Up in ${level_value.toFixed(1)}/${level_target.toFixed(1)} pts`
      : `Score ${level_value.toFixed(1)}`)
    : (isUnranked
      ? `Reach ${level_target.toFixed(1)} hrs`
      : `${level_value.toFixed(1)}/${level_target.toFixed(1)} hrs`);

  const rankLine = isGithubSource
    ? `<tspan font-size="11">Percentile </tspan><tspan font-size="15" font-weight="bold">${rankDisplay}</tspan>`
    : `<tspan font-size="11">Rank </tspan><tspan font-size="9">#</tspan><tspan font-size="15" font-weight="bold">${rankDisplay}</tspan>`;

  const tierLine = isGithubSource
    ? `${rankTitle} Tier: ${rangeText}`
    : `${rankTitle} Tier: ${isUnranked ? rangeText : `<tspan font-size="10">#</tspan>${rangeText}`}`;

  let rightContent;
  let rightBlockHeight = 0;
  if (isGithubSource && cardMode === 'stats' && activeSourceGithubStats) {
    const iconNames = {
      stars: 'stars',
      commits: 'commits',
      prs: 'pullRequests',
      issues: 'issues',
      reviews: 'reviews',
      followers: 'followers',
      repos: 'contributions'
    };
    const lines = [
      { label: 'Total Stars:', value: formatNum(activeSourceGithubStats.stars), icon: iconNames.stars },
      { label: 'Total Commits:', value: formatNum(activeSourceGithubStats.commits), icon: iconNames.commits },
      { label: 'Total PRs:', value: formatNum(activeSourceGithubStats.prs), icon: iconNames.prs },
      { label: 'Total Issues:', value: formatNum(activeSourceGithubStats.issues), icon: iconNames.issues },
      { label: 'Total Reviews:', value: formatNum(activeSourceGithubStats.reviews), icon: iconNames.reviews },
      { label: 'Followers:', value: formatNum(activeSourceGithubStats.followers), icon: iconNames.followers },
      { label: 'Contributed to:', value: formatNum(activeSourceGithubStats.repos), icon: iconNames.repos },
    ];
    const statsLines = renderTwoColumnLines(lines, 35, 18, show_icons);
    rightContent = `
      <text x="${rhsX}" y="15" font-size="11" fill="#${text_color}" font-family="${font_family}" font-weight="bold">GitHub Stats</text>
      ${statsLines}
    `;
    const rowCount = Math.ceil(lines.length / 2);
    const lastLineY = 35 + (rowCount - 1) * 18;
    rightBlockHeight = (lastLineY - 15) + 18; // title to last line + line height
  } else if (isGithubSource && cardMode === 'progress' && activeSourceGithubStats) {
    const lines = [];
    const labels = {
      repos: 'Total Repos',
      commits: 'Total Commits',
      prs: 'Total PRs',
      issues: 'Total Issues',
      reviews: 'Total Reviews',
      stars: 'Total Stars',
      followers: 'Total Followers'
    };
    const iconNames = {
      repos: 'contributions',
      commits: 'commits',
      prs: 'pullRequests',
      issues: 'issues',
      reviews: 'reviews',
      stars: 'stars',
      followers: 'followers'
    };

    if (targetPercentile === null || !progressPlan) {
      lines.push({ label: 'Status:', value: 'Top tier reached' });
    } else {
      const added = progressPlan.added || {};
      const medians = getMedians(true);
      const used = Object.entries(added)
        .filter(([, v]) => v > 0)
        .sort((a, b) => medians[a[0]] - medians[b[0]]);
      const totalAdded = used.reduce((sum, [, v]) => sum + v, 0);
      if (totalAdded === 0 && progressPlan.reached !== false) {
        lines.push({ label: 'Status:', value: 'Already at next tier' });
      } else if (used.length) {
        const metricNames = used.map(([k]) => labels[k]).join(' / ');
        used.forEach(([key, count]) => {
          lines.push({ label: `${labels[key]}:`, value: `+${formatNum(count)}`, icon: iconNames[key] });
        });
        if (progressPlan.capped) {
          lines.push({ label: 'Note:', value: 'Approximate; may need more' });
        }
      } else {
        lines.push({ label: 'Suggestion:', value: 'Add activity to lowest medians' });
      }
    }
    const progressLines = renderTwoColumnLines(lines, 35, 18, show_icons);
    const rowCount = Math.max(1, Math.ceil(lines.length / 2));
    const barY = 35 + rowCount * 18 + 10;
    const barBlock = `
      <rect x="${rhsX}" y="${barY}" width="${progressBarWidth}" height="8" fill="#${rank_color}" rx="4" opacity="0.3"/>
      <rect x="${rhsX}" y="${barY}" width="${progress * progressBarWidth}" height="8" fill="#${rank_color}" rx="4"/>
      <text x="${rhsX + progressBarWidth}" y="${barY + 25}" font-size="11" text-anchor="end" fill="#${text_color}" font-family="${font_family}">
        ${progressText}
      </text>
    `;
    rightContent = `
      <text x="${rhsX}" y="15" font-size="11" fill="#${text_color}" font-family="${font_family}" font-weight="bold">Progress to next tier</text>
      ${progressLines}
      ${barBlock}
    `;
    rightBlockHeight = (barY + 25) - 15 + 12; // from title to bar label + font height
  } else {
    rightContent = `
    <text x="${rhsX}" y="30" fill="#${text_color}" font-family="${font_family}">
      ${rankLine}
    </text>
    <text x="${rhsX}" y="50" font-size="11" fill="#${text_color}" font-family="${font_family}">
      ${tierLine}
    </text>
    <rect x="${rhsX}" y="65" width="${barWidth}" height="8" fill="#${rank_color}" rx="4" opacity="0.3"/>
    <rect x="${rhsX}" y="65" width="${progress * barWidth}" height="8" fill="#${rank_color}" rx="4"/>
    <text x="${rhsX + barWidth}" y="95" font-size="11" text-anchor="end" fill="#${text_color}" font-family="${font_family}">
      ${progressText}
    </text>`;
    rightBlockHeight = (95 - 30) + 16; // text range plus padding
  }

  const componentTitle = activeSource === 'github' ? 'Yearly Ranking' : 'Weekly Ranking';
  const cardWidth = rhsX + barWidth + (cardMode === 'progress' ? 28 : 0) + 40 + (cardMode === 'stats' ? 42 : 0) + (show_icons ? 35 : 0);
  const titleSvg = hide_title
    ? ''
    : `<text x="${cardWidth / 2}" y="25" font-size="16" text-anchor="middle" fill="#${text_color}" font-family="${font_family}" font-weight="bold">${componentTitle}</text>`;

  const titleOffset = hide_title ? 0 : 35;
  // Center RHS relative to the star cluster (upper portion), not the bottom rank label.
  const availableHeight = cardMode === 'level' ? 85 : 115;
  const rightYOffset = Math.max(0, (availableHeight - rightBlockHeight) / 2);

  return {
    content: `
      ${glowFilter}
      ${titleSvg}
      <g transform="translate(0, ${titleOffset})">${stars.join('\n')}</g>
      <text x="67.5" y="110" transform="translate(0, ${titleOffset})" font-size="15" text-anchor="middle" fill="#${text_color}" font-family="${font_family}">
        ${rankTitle}
      </text>
      <g transform="translate(0, ${titleOffset + rightYOffset})">${rightContent}</g>
    `,
    height: 120 + titleOffset,
    width: cardWidth
  };
}
