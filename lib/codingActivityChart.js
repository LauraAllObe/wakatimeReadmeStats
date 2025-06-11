import { createCanvas } from 'canvas';

function formatShortTime(seconds) {
  if (seconds === 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}m`;
}

function getDayIndex(dayCode) {
  const map = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
  return map[dayCode.toLowerCase()] ?? -1;
}

function reorderDays(days, startDayCode) {
  const targetIndex = getDayIndex(startDayCode);
  if (targetIndex < 0) return days;

  return [...days].sort((a, b) => {
    const getDay = d => new Date(d.range.date).getDay();
    const offset = day => (getDay(day) - targetIndex + 7) % 7;
    return offset(a) - offset(b);
  });
}

export async function getCodingActivityChart({
  username,
  chart_color = '00aaff',
  chart_type = 'bar',
  start_day = '-7',
  hide_legend = false,
  hide_total = false,
  hide_time = false,
  hide_percentage = false,
  hide_title = false
}) {
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
  let days = json.data;
  if (!days || days.length === 0) {
    throw new Error('No 7-day summary data available.');
  }

  if (start_day && start_day !== '-7') {
    days = reorderDays(days, start_day);
  }

  const totalSeconds = days.reduce((sum, d) => sum + d.grand_total.total_seconds, 0);
  const maxSeconds = Math.max(...days.map(d => d.grand_total.total_seconds));

  const barWidth = 30;
  const spacing = 15;
  const titleHeight = hide_title ? 0 : 20;
  const chartTop = titleHeight + 10;
  const chartHeight = 60;
  const chartBottom = 60;
  const chartBase = chartTop + chartHeight;
  const height = chartBase + chartBottom;
  const chartWidth = days.length * (barWidth + spacing);
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const chartSvgBlocks = (() => {
    switch (chart_type) {
      case 'bar': {
        return days.map((d, i) => {
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          let barHeight = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          if (barHeight === 0 && seconds === 0) {
            barHeight = 1.5;
          }
          const x = i * (barWidth + spacing) + 30;
          const y = chartBase - barHeight;

          const blocks = [];

          blocks.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#${chart_color}" rx="3" ry="3" />`);

          const shortTime = formatShortTime(seconds);
          if (!hide_time) {
            blocks.push(`<text x="${x + barWidth / 2}" y="${y - 4}" font-size="9" text-anchor="middle" fill="#555">${shortTime}</text>`);
          }

          const dayName = weekdayNames[new Date(d.range.date).getDay()];
          blocks.push(`<text x="${x + barWidth / 2}" y="${chartBase + 12}" font-size="10" text-anchor="middle" fill="#666">${dayName}</text>`);

          if (!hide_percentage) {
            blocks.push(`<text x="${x + barWidth / 2}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#aaa">${pct}%</text>`);
          }

          return blocks.join('\n');
        });
      }

      case 'line':
      case 'area':
      case 'radar':
      case 'bubble':
      case 'donut':
      case 'spiral': {
        return [`<text x="30" y="${chartBase}" font-size="12" fill="#888">[${chart_type} chart placeholder]</text>`];
      }

      default: {
        return [`<text x="30" y="${chartBase}" font-size="12" fill="red">Invalid chart type: ${chart_type}</text>`];
      }
    }
  })();

  const totalTimeText = json.cumulative_total.text;

  const title = !hide_title
    ? `<text x="${chartWidth / 2 + 20}" y="0" font-size="14" text-anchor="middle" fill="#333" font-weight="bold">Last 7 Days</text>`
    : '';

  const centeredTotal = !hide_total
    ? `<text x="${chartWidth / 2 + 20}" y="${height - 10}" font-size="12" text-anchor="middle" fill="#333"><tspan font-weight="bold">Total:</tspan> ${totalTimeText}</text>`
    : '';

  return {
    content: `
      ${title}
      ${chartSvgBlocks.join('\n')}
      ${centeredTotal}
    `,
    height,
    width: chartWidth + 48
  };
}