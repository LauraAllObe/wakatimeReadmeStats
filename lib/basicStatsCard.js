import { createCanvas } from 'canvas';

function formatLongDate(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' :
    day % 10 === 2 && day !== 12 ? 'nd' :
    day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const options = { month: 'long', year: 'numeric' };
  const monthYear = date.toLocaleDateString('en-US', options);
  return `${monthYear.split(' ')[0]} ${day}${suffix}, ${monthYear.split(' ')[1]}`;
}

export async function getBasicStatsCard({
  api_key,
  github_token,
  default_source = 'github',
  username,
  text_color,
  font_family,
  hide_daily_average,
  hide_total_time,
  hide_languages,
  hide_projects,
  hide_operating_systems,
  hide_most_active_day,
  hide_github_contributions,
  hide_github_commits,
  hide_github_prs,
  hide_github_issues,
  hide_github_reviews,
  hide_github_stars,
  hide_github_followers
}) {
  text_color = text_color.replace(/^#/, '');
  const parseBool = (v, def = false) => v === undefined ? def : (v === true || v === 'true');
  const apiKey = api_key ?? '';
  const sourcePref = (default_source ?? 'github').toLowerCase();
  const hasGithub = !!github_token;
  const useGithub = sourcePref === 'github' && hasGithub;
  const useCombo = sourcePref === 'combo' || (sourcePref === 'github' && hasGithub);

  let stats = null;
  let githubStats = null;

  if (useGithub || useCombo) {
    try {
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      let stars = 0;
      let cursor = null;
      let hasNext = true;
      const query = `
        query basicStats($login:String!, $from:DateTime!, $to:DateTime!, $after:String) {
          user(login:$login) {
            followers { totalCount }
            contributionsCollection(from:$from, to:$to) {
              totalCommitContributions
              totalPullRequestContributions
              totalIssueContributions
              totalPullRequestReviewContributions
              repositoriesContributedTo { totalCount }
              contributionCalendar {
                weeks { contributionDays { date contributionCount } }
              }
            }
            repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork:false, first:100, after:$after) {
              nodes { stargazerCount }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `;
      while (hasNext) {
        const res = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${github_token}`
          },
          body: JSON.stringify({ query, variables: { login: username, from: from.toISOString(), to: to.toISOString(), after: cursor } })
        });
        const json = await res.json();
        if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '));
        const user = json.data?.user;
        if (!user) throw new Error('GitHub user not found');
        if (!githubStats) githubStats = user;
        user.repositories?.nodes?.forEach(repo => { stars += repo?.stargazerCount ?? 0; });
        hasNext = user.repositories?.pageInfo?.hasNextPage;
        cursor = user.repositories?.pageInfo?.endCursor;
      }
      if (githubStats) githubStats.stars = stars;
    } catch (err) {
      console.error('GitHub basic stats fallback to WakaTime:', err.message);
      githubStats = null;
    }
  }

  if (!githubStats || useCombo || sourcePref === 'waka') {
    if (!apiKey) {
      if (!githubStats) throw new Error('Missing WAKATIME_API_KEY');
    } else {
      const authHeader = {
        headers: { Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}` }
      };
      try {
        const res = await fetch(`https://wakatime.com/api/v1/users/${username}/stats/last_year`, authHeader);
        stats = (await res.json()).data;
      } catch (err) {
        console.error('WakaTime fetch error:', err);
        if (!githubStats) throw new Error('Failed to fetch WakaTime stats');
      }
    }
  }

  const measureTextWidth = (text, font = `${13}px ${font_family}`) => {
    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
  };

  const total = stats?.human_readable_total || 'N/A';
  const avg = stats?.human_readable_daily_average || 'N/A';
  const langs = stats?.languages?.slice(0, 3).map(l => l.name).join(', ') || 'N/A';
  const projects = stats?.projects?.slice(0, 3).map(p => p.name).join(', ') || 'N/A';
  const systems = stats?.operating_systems?.slice(0, 3).map(o => o.name).join(', ') || 'N/A';
  const dateRaw = stats?.best_day?.date ?? null;
  const wakaBestValue = stats?.best_day?.total_seconds ?? 0;
  const date = dateRaw ? formatLongDate(dateRaw) : 'N/A';

  const gh = githubStats;
  const ghContrib = gh?.contributionsCollection;
  const ghReposContributed = ghContrib?.repositoriesContributedTo?.totalCount ?? 0;
  const ghTotal =
    (ghContrib?.totalCommitContributions ?? 0) +
    (ghContrib?.totalPullRequestContributions ?? 0) +
    (ghContrib?.totalIssueContributions ?? 0) +
    (ghContrib?.totalPullRequestReviewContributions ?? 0);
  let ghBestDay = 'N/A';
  let ghBestValue = 0;
  if (ghContrib?.contributionCalendar?.weeks) {
    const days = ghContrib.contributionCalendar.weeks.flatMap(w => w.contributionDays ?? []);
    const best = days.reduce((acc, d) => d.contributionCount > (acc?.contributionCount ?? -1) ? d : acc, null);
    if (best?.date) {
      ghBestDay = formatLongDate(best.date);
      ghBestValue = best.contributionCount ?? 0;
    }
  }

  const lineHeight = 13 * 1.7;
  const linesRaw = [];

  const addLine = (label, value) => {
    linesRaw.push({ label, value });
  };

  const ghHide = {
    contributions: parseBool(hide_github_contributions, false),
    commits: parseBool(hide_github_commits, false),
    prs: parseBool(hide_github_prs, false),
    issues: parseBool(hide_github_issues, false),
    reviews: parseBool(hide_github_reviews, false),
    stars: parseBool(hide_github_stars, false),
    followers: parseBool(hide_github_followers, false)
  };

  const includeGithub = (sourcePref === 'github' && githubStats) || (useCombo && githubStats);
  const includeWaka = sourcePref !== 'github' || useCombo || !githubStats;

  if (includeGithub) {
    if (!ghHide.contributions && !hide_total_time) addLine("Repos Contributed To (12m)", ghReposContributed || 'N/A');
    if (!ghHide.commits && !hide_daily_average) addLine("Commits", ghContrib?.totalCommitContributions ?? 'N/A');
    if (!ghHide.prs && !hide_languages) addLine("Pull Requests", ghContrib?.totalPullRequestContributions ?? 'N/A');
    if (!ghHide.issues && !hide_projects) addLine("Issues", ghContrib?.totalIssueContributions ?? 'N/A');
    if (!ghHide.reviews && !hide_operating_systems) addLine("Reviews", ghContrib?.totalPullRequestReviewContributions ?? 'N/A');
    if (!ghHide.stars) addLine("Stars", githubStats?.stars ?? 'N/A');
    if (!ghHide.followers) addLine("Followers", githubStats?.followers?.totalCount ?? 'N/A');
  }

  if (includeWaka && stats) {
    if (!hide_total_time) addLine("Total Time", total);
    if (!hide_daily_average) addLine("Daily Average", avg);
    if (!hide_languages) addLine("Top Languages", langs);
    if (!hide_projects) addLine("Top Projects", projects);
    if (!hide_operating_systems) addLine("Top OS", systems);
  }

  const bestDayValue = (() => {
    if (useCombo && stats && githubStats) {
      if (wakaBestValue > 0 && ghBestValue > 0) {
        return { label: "Most Active Day", value: date }; // prefer Waka when units differ
      }
    }
    if (stats && wakaBestValue > 0) return { label: "Most Active Day", value: date };
    if (githubStats && ghBestDay !== 'N/A') return { label: "Most Active Day", value: ghBestDay };
    return null;
  })();

  if (!hide_most_active_day && bestDayValue) {
    addLine(bestDayValue.label, bestDayValue.value);
  }

  const totalLines = linesRaw.length;
  const height = lineHeight * totalLines;

  // Assign last line y = 0, lines above it negative y
  const lines = linesRaw
    .map(({ label, value }, i) => {
      const y = -(totalLines - 1 - i) * lineHeight; // last line gets y=0
      return `<text font-family="${font_family}" x="20" y="${y}" fill="#${text_color}" font-size="13"><tspan font-weight="bold">${label}:</tspan> ${value}</text>`;
    });

  // Translate group down so bottom line sits at normal baseline
  const translatedGroup = `<g transform="translate(0, ${height})">\n${lines.join('\n')}\n</g>`;

  const textBlocks = linesRaw.map(({ label, value }) => `${label}: ${value}`);
  const maxTextWidth = Math.max(...textBlocks.map(text => measureTextWidth(text, `${13}px ${font_family}`)));
  const finalWidth = Math.ceil(maxTextWidth + 40); // 20px left/right padding

  return {
    content: translatedGroup,
    height: Math.ceil(height),
    width: finalWidth
  };
}
