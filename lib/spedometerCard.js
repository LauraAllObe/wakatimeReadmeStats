import { createCanvas } from 'canvas';

function secondsToHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return { h, m };
}

function formatHM({ h, m }) {
  return `${h} hrs ${m} mins`;
}

function generateArrow(diff) {
  return diff >= 0 ? '↑' : '↓';
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return `M ${start.x} ${start.y}
          A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export async function getSpedometerCard({ username, text_color = '333333', font_family = 'Calibri' }) {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

  const headers = {
    Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
  };

  const [todayData, yearlyStats] = await Promise.all([
    fetch(`https://wakatime.com/api/v1/users/${username}/durations?date=today`, { headers }).then(res => res.json()),
    fetch(`https://wakatime.com/api/v1/users/${username}/stats/last_year`, { headers }).then(res => res.json())
  ]);

  const todaySeconds = todayData?.data?.reduce((sum, s) => sum + s.duration, 0) || 0;
  const avgSeconds = yearlyStats?.data?.daily_average || 1;
  const mostActiveDay = yearlyStats?.data?.best_day?.text || 'N/A';

  const percent = Math.min((todaySeconds / avgSeconds) * 100, 200);
  const percentChange = Math.round(((todaySeconds - avgSeconds) / avgSeconds) * 100);
  const todayHM = secondsToHMS(todaySeconds);
  const avgHM = secondsToHMS(avgSeconds);

  const width = 300;
  const height = 240;
  const cx = width / 2;
  const cy = 140;
  const r = 80;

  // Natural (unrotated) 0°–180° arcs
  const segments = [
    { start: 0, end: 36, color: '#2ecc71', label: 'Needs Work' },
    { start: 36, end: 72, color: '#1abc9c', label: 'Warming Up' },
    { start: 72, end: 108, color: '#f1c40f', label: 'Getting There' },
    { start: 108, end: 144, color: '#e67e22', label: 'On Fire!' },
    { start: 144, end: 180, color: '#e74c3c', label: 'Ultra Instinct' }
  ];

  const arcGroup = `
    <g transform="rotate(-90, ${cx}, ${cy})">
      ${segments.map(s =>
        `<path d="${describeArc(cx, cy, r, s.start, s.end)}" stroke="${s.color}" stroke-width="45" fill="none" />`
      ).join('\n')}
      ${segments.map(s => {
        const angle = (s.start + s.end) / 2;
        const { x, y } = polarToCartesian(cx, cy, r + 24, angle);
        return `<text x="${x}" y="${y}" font-size="8" text-anchor="middle" fill="#${text_color}" font-family="${font_family}">${s.label}</text>`;
      }).join('\n')}
    </g>
  `;

  // Needle
  const angleDeg = 180 - Math.min(percent, 100) * 1.8;
  const tip = polarToCartesian(cx, cy, r - 4, angleDeg);
  const left = polarToCartesian(cx, cy, 7, angleDeg + 90);
  const right = polarToCartesian(cx, cy, 7, angleDeg - 90);

  const needle = `
    <polygon points="${left.x},${left.y} ${tip.x},${tip.y} ${right.x},${right.y}" fill="black" />
    <circle cx="${cx}" cy="${cy}" r="4" fill="black"/>
  `;

  return {
    content: `
  <text x="50%" y="22" text-anchor="middle" font-size="14" fill="#${text_color}" font-family="${font_family}">
    ${formatHM(todayHM)} Today
  </text>
  ${arcGroup}
  ${needle}
  <text x="50%" y="${cy + 50}" text-anchor="middle" font-size="13" fill="#${text_color}" font-family="${font_family}">
    ${generateArrow(percentChange)} ${Math.abs(percentChange)}% ${percentChange >= 0 ? 'increase' : 'decrease'}
  </text>
  <text x="50%" y="${cy + 70}" text-anchor="middle" font-size="13" fill="#${text_color}" font-family="${font_family}">
    ${formatHM(avgHM)} Daily Average
  </text>
  <text x="50%" y="${cy + 90}" text-anchor="middle" font-size="13" fill="#${text_color}" font-family="${font_family}">
    ${mostActiveDay} Most Active Day
  </text>
  `,
    width,
    height
  };
}
