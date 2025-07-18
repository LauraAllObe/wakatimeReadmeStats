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
  username,
  text_color,
  font_family,
  hide_daily_average,
  hide_total_time,
  hide_languages,
  hide_projects,
  hide_operating_systems,
  hide_most_active_day
}) {
  text_color = text_color.replace(/^#/, '');
  const apiKey = api_key ?? '';
  if (!apiKey || apiKey === '') throw new Error('Missing WAKATIME_API_KEY');

  const authHeader = {
    headers: { Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}` }
  };

  let stats;
  try {
    const res = await fetch(`https://wakatime.com/api/v1/users/${username}/stats/last_year`, authHeader);
    stats = (await res.json()).data;
  } catch (err) {
    console.error('WakaTime fetch error:', err);
    throw new Error('Failed to fetch WakaTime stats');
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
  const date = dateRaw ? formatLongDate(dateRaw) : 'N/A';

  const lineHeight = 13 * 1.7;
  const linesRaw = [];

  const addLine = (label, value) => {
    linesRaw.push({ label, value });
  };

  if (!hide_total_time) addLine("Total Time", total);
  if (!hide_daily_average) addLine("Daily Average", avg);
  if (!hide_languages) addLine("Top Languages", langs);
  if (!hide_projects) addLine("Top Projects", projects);
  if (!hide_operating_systems) addLine("Top OS", systems);
  if (!hide_most_active_day) addLine("Most Active Day", date);

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
