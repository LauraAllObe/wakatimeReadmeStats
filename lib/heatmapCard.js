import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export async function getHeatmapCard({
  username,
  heatmapColor = '00ff00',
  startDay = 'mo',
  time = 'last_year',
  bg_color = 'ffffff',
  title_color = '333333',
  text_color = '000000',
  logo_color = '000000',
  font_family = 'Calibri',
  width = '700',
  showLogo = true,
}) {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

  // Load logo if requested
  let logoSvg = '';
  if (String(showLogo) === 'true') {
    try {
      const rawLogo = fs.readFileSync(path.join(process.cwd(), 'static', 'wakatime.svg'), 'utf-8');
      const inner = rawLogo
        .replace(/<\?xml[^>]*>/g, '')
        .replace(/<!DOCTYPE[^>]*>/g, '')
        .replace(/<svg[^>]*>/, '')
        .replace('</svg>', '');
      logoSvg = `<g transform="translate(20,15) scale(0.075)" style="color:#${logo_color}">${inner}</g>`;
    } catch {
      console.warn('⚠️ Logo missing or invalid.');
    }
  }

  // Attempt to fetch per-day stats
  const resp = await fetch(
    `https://wakatime.com/api/v1/users/${username}/stats/${time}?is_including_today=true`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
      }
    }
  );

  const json = await resp.json();
  const stats = json.data;

  if (!resp.ok || !stats?.is_up_to_date) {
    throw new Error('WakaTime stats are not available or are still updating. Please retry later.');
  }

  // Check for per-day breakdown
  const daily = stats.days;
  if (!daily || daily.length === 0) {
    throw new Error('No per-day data available. Consider upgrading to WakaTime Premium or stay logged-in to wakatime.');
  }

  const byDate = daily.reduce((acc, day) => {
    acc[day.date] = day.grand_total.total_seconds;
    return acc;
  }, {});
  const max = Math.max(...Object.values(byDate), 0);

  // Build 365-day grid
  const today = new Date();
  const daysArr = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d;
  }).reverse();

  const dayOffset = startDay === 'su' ? 0 : 1;

  const cells = daysArr.map(d => {
    const week = Math.floor((d.getTime() / 86400000 + dayOffset) / 7);
    const weekday = (d.getDay() + 6) % 7;
    const key = d.toISOString().slice(0,10);
    const secs = byDate[key] || 0;
    const opacity = max ? ((secs / max) * 0.9 + 0.1).toFixed(2) : 0;
    return `<rect x="${week * 12 + 20}" y="${weekday * 12 + 50}" width="10" height="10" fill="#${heatmapColor}" fill-opacity="${opacity}" />`;
  }).join('\n');

  // Title & logo
  const titleLine = String(showLogo) === 'true'
    ? `${logoSvg}<text x="50" y="28" fill="#${title_color}" font-size="16">WakaTime Heatmap</text>`
    : `<text x="20" y="30" fill="#${title_color}" font-size="16">WakaTime Heatmap</text>`;

  const height = 50 + 7 * 12 + 20;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family:${font_family},sans-serif;font-size:10;">
  <rect width="100%" height="100%" fill="#${bg_color}" />
  ${titleLine}
  ${cells}
</svg>`;
}
