export async function getHeatmapCard({
  api_key,
  github_token,
  default_source = 'github',
  username,
  font_family,
  heatmap_color,
  start_day,
  text_color,
  hide_title,
  heading_type,
}) {
  heatmap_color = heatmap_color.replace(/^#/, '');
  text_color = text_color.replace(/^#/, '');
  const apiKey = api_key ?? '';
  const sourcePref = (default_source ?? 'github').toLowerCase();
  const hasGithub = !!github_token;
  const wantsCombo = sourcePref === 'combo' || (sourcePref === 'github' && hasGithub && apiKey);
  const today = new Date();
  const byDate = {};
  const githubByDate = {};
  const wakaByDate = {};

  if (hasGithub) {
    try {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const query = `
        query heatmap($login:String!, $from:DateTime!, $to:DateTime!) {
          user(login:$login) {
            contributionsCollection(from:$from, to:$to) {
              contributionCalendar {
                weeks {
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
            }
          }
        }
      `;
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${github_token}`
        },
        body: JSON.stringify({
          query,
          variables: { login: username, from: from.toISOString(), to: today.toISOString() }
        })
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '));
      const weeks = json.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
      weeks.forEach(week => {
        week.contributionDays?.forEach(day => {
          if (day.date) githubByDate[day.date] = day.contributionCount || 0;
        });
      });
    } catch (err) {
      console.error('GitHub heatmap fetch failed:', err.message);
    }
  }

  if (!hasGithub || wantsCombo || sourcePref === 'waka' || Object.keys(githubByDate).length === 0) {
    if (!apiKey && (sourcePref !== 'github' || wantsCombo || Object.keys(githubByDate).length === 0)) {
      throw new Error('Missing WAKATIME_API_KEY');
    }
    const resp = await fetch(
      `https://wakatime.com/api/v1/users/current/insights/days/last_year`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
        }
      }
    );

    const json = await resp.json();
    if (!resp.ok || !json?.data?.days) {
      throw new Error(`WakaTime API error: ${json.error || 'Invalid response'}`);
    }

    const days = json.data.days;
    days.forEach(day => {
      if (day.date && typeof day.total === 'number') {
        wakaByDate[day.date] = day.total;
      }
    });
  }

  if (wantsCombo && Object.keys(githubByDate).length > 0 && Object.keys(wakaByDate).length > 0) {
    Object.keys({ ...githubByDate, ...wakaByDate }).forEach(date => {
      byDate[date] = Math.max(githubByDate[date] ?? 0, wakaByDate[date] ?? 0);
    });
  } else if (sourcePref === 'github' && Object.keys(githubByDate).length > 0) {
    Object.assign(byDate, githubByDate);
  } else {
    Object.assign(byDate, Object.keys(wakaByDate).length > 0 ? wakaByDate : githubByDate);
  }

  // --- Calculate most productive month ---
  const totalsByMonth = Array(12).fill(0);
  for (const [dateStr, total] of Object.entries(byDate)) {
    const month = new Date(dateStr).getMonth();
    totalsByMonth[month] += total;
  }
  const maxMonthIndex = totalsByMonth.indexOf(Math.max(...totalsByMonth));
  const monthName = new Date(2000, maxMonthIndex).toLocaleString('default', { month: 'long' });

  const headingText =
    heading_type === 'friendly'
      ? `This year, my most productive month was ${monthName}`
      : (wantsCombo ? 'COMBINED ACTIVITY LAST YEAR' : (hasGithub ? 'GITHUB ACTIVITY LAST YEAR' : 'ACTIVITY LAST YEAR'));

  const startFromSunday = start_day === 'su';
  const cellSize = 10;
  const cellGap = 2;
  const topPadding = 50;
  const leftPadding = 40;

  const daysArr = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d;
  }).reverse();

  let gridRects = '';
  let monthLabels = {};
  const max = Math.max(...Object.values(byDate), 0) || 1;

  daysArr.forEach((d, i) => {
    const key = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    const weekday = startFromSunday ? dayOfWeek : (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const dayOffset = Math.floor((d - daysArr[0]) / (1000 * 60 * 60 * 24));
    const week = Math.floor(dayOffset / 7);
    const x = week * (cellSize + cellGap);
    const y = weekday * (cellSize + cellGap);

    const secs = byDate[key] || 0;
    const opacity = ((secs / max) * 0.9 + 0.1).toFixed(2);
    gridRects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" ry="2" fill="#${heatmap_color}" fill-opacity="${opacity}" stroke="#${text_color}" stroke-width="0.5" />\n`;

    const month = d.getMonth();
    if (!monthLabels[month] || d.getDate() === 1) {
      monthLabels[month] = x;
    }
  });

  const monthLabelEls = Object.entries(monthLabels).map(([month, x]) => {
    const label = new Date(2000, Number(month)).toLocaleString('default', { month: 'short' });
    return `<text x="${x}" y="-6" font-size="10" fill="#${text_color}" font-family="${font_family}">${label}</text>`;
  }).join('\n');

  const dayLabels = startFromSunday ? ['Sun', 'Tue', 'Thu'] : ['Mon', 'Wed', 'Fri'];
  const dayIndexes = startFromSunday ? [0, 2, 4] : [0, 2, 4];

  const dayLabelEls = dayIndexes.map(i => {
    const y = i * (cellSize + cellGap) + cellSize / 2;
    return `<text x="-6" y="${y}" font-size="10" text-anchor="end" alignment-baseline="middle" fill="#${text_color}" font-family="${font_family}">${dayLabels[i / 2]}</text>`;
  }).join('\n');

  const gridHeight = 7 * (cellSize + cellGap);
  const gridWidth = 53 * (cellSize + cellGap);
  const width = gridWidth + leftPadding + 20;
  const height = topPadding + gridHeight + 40;

  const title = !hide_title
    ? `<text x="${leftPadding}" y="18" font-size="14" fill="#${text_color}" font-family="${font_family}" font-weight="bold">
        ${headingText}
      </text>`
    : '';

  return {
    width,
    height,
    content: `
      ${title}
      <g transform="translate(${leftPadding}, ${topPadding})">
        ${monthLabelEls}
        ${dayLabelEls}
        ${gridRects}
        <text x="${gridWidth - 145}" y="${gridHeight + 14}" font-size="10" fill="#${text_color}" font-family="${font_family}">Less</text>
        ${[0.1, 0.3, 0.5, 0.7, 0.9, 1].map((o, i) =>
          `<rect x="${gridWidth - 145 + 30 + i * 12}" y="${gridHeight + 6}" width="10" height="10" rx="2" ry="2" fill="#${heatmap_color}" fill-opacity="${o}"/>`
        ).join('\n')}
        <text x="${gridWidth - 38}" y="${gridHeight + 14}" font-size="10" fill="#${text_color}" font-family="${font_family}">More</text>
      </g>
    `
  };
}
