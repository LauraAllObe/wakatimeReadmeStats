import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

function formatDate(dateStr) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const [year, month, day] = dateStr.split('-').map(Number);

  const suffix = (d) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${day}${suffix(day)} ${months[month - 1]}, ${year}`;
}

export async function getBasicStatsCard({
  username,
  bg_color = 'ffffff',
  title_color = '333333',
  text_color = '999999',
  logo_color = '000000',
  font_family = 'Calibri',
  width = '400',
  showLogo = true,
  hideLanguages = false,
  hideProjects = false,
  hideOperatingSystems = false,
  hideMostActiveDay = false
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

  const total = stats?.human_readable_total || 'N/A';
  const avg = stats?.human_readable_daily_average || 'N/A';
  const langs = stats?.languages?.slice(0, 3).map(l => l.name).join(', ') || 'N/A';
  const projects = stats?.projects?.slice(0, 3).map(p => p.name).join(', ') || 'N/A';
  const systems = stats?.operating_systems?.slice(0, 3).map(o => o.name).join(', ') || 'N/A';
  const date = stats?.best_day?.date ? formatDate(stats.best_day.date) : 'N/A';

  const logoPath = path.join(process.cwd(), 'static', 'wakatime.svg');
  let logoSvg = '';
  if (String(showLogo) === 'true') {
    try {
      const rawLogo = fs.readFileSync(logoPath, 'utf-8');
      const innerSvg = rawLogo
        .replace(/<\?xml[^>]*>/g, '')
        .replace(/<!DOCTYPE[^>]*>/g, '')
        .replace(/<svg[^>]*>/, '')
        .replace('</svg>', '');

      logoSvg = `<g transform="translate(20,12.5) scale(0.075)" style="color:#${logo_color}">${innerSvg}</g>`;
    } catch (e) {
      console.warn('⚠️ Logo file missing or invalid.', e);
    }
  }

  const lines = [
    String(showLogo) === 'true'
      ? `${logoSvg}<text x="50" y="28" fill="#${title_color}" font-size="16">WakaTime Stats</text>`
      : `<text x="20" y="30" fill="#${title_color}" font-size="16">WakaTime Stats</text>`,
    `<text x="20" y="60" fill="#${text_color}"><tspan font-weight="bold">Total Time (Last Year):</tspan> ${total}</text>`,
    `<text x="20" y="85" fill="#${text_color}"><tspan font-weight="bold">Daily Average:</tspan> ${avg}</text>`
  ];

  let y = 110;
  const step = 25;
  if (!hideLanguages) {
    lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Top Languages:</tspan> ${langs}</text>`);
    y += step;
  }
  if (!hideProjects) {
    lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Top Projects:</tspan> ${projects}</text>`);
    y += step;
  }
  if (!hideOperatingSystems) {
    lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Top OS:</tspan> ${systems}</text>`);
    y += step;
  }
  if (!hideMostActiveDay) {
    lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Most Active Day:</tspan> ${date}</text>`);
    y += step;
  }

  return `
    <svg width="${width}" height="${y + 20}" xmlns="http://www.w3.org/2000/svg" style="font-family: ${font_family}, sans-serif; font-size: 12;">
      <rect width="100%" height="100%" fill="#${bg_color}" />
      ${lines.join('\n')}
    </svg>
  `;
}