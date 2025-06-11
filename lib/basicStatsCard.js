import { createCanvas } from 'canvas';

export async function getBasicStatsCard({
  username,
  text_color,
  font_family,
  hide_languages,
  hide_projects,
  hide_operating_systems,
  hide_most_active_day
}) {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

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
  const date = stats?.best_day?.date ?? 'N/A';

  const lineHeight = 13 * 1.7;
  let y = lineHeight;
  const lines = [];
  const textBlocks = [];

  const addLine = (label, value) => {
    const text = `${label}: ${value}`;
    textBlocks.push(text);
    lines.push(`<text x="20" y="${y}" fill="#${text_color}" font-size="${13}"><tspan font-weight="bold">${label}:</tspan> ${value}</text>`);
    y += lineHeight;
  };

  addLine("Total Time", total);
  addLine("Daily Average", avg);
  if (!hide_languages) addLine("Top Languages", langs);
  if (!hide_projects) addLine("Top Projects", projects);
  if (!hide_operating_systems) addLine("Top OS", systems);
  if (!hide_most_active_day) addLine("Most Active Day", date);

  const maxTextWidth = Math.max(...textBlocks.map(text => measureTextWidth(text, `${13}px ${font_family}`)));
  const finalWidth = Math.ceil(maxTextWidth + 40); // 20px left/right padding

  return {
    content: lines.join('\n'),
    height: Math.ceil(y),
    width: finalWidth
  };
}
