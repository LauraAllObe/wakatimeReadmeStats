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

function hexToRgb(hex) {
  const bigint = parseInt(hex.replace(/^#/, ''), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r, g, b) {
  return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function darkenColor(hex, amount = 30) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, r - amount),
    Math.max(0, g - amount),
    Math.max(0, b - amount)
  );
}

export async function getCodingActivityChart({
  username,
  text_color = '999999',
  chart_color = '00aaff',
  chart_type = 'bar',
  bg_color = 'ffffff',
  chart_curved_line = false,
  start_day = '-7',
  heading_type = 'standard',
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

  // --- Friendly heading
  let headingText = 'Last Week\'s Coding Time';
  if (parseInt(heading_type) === 'friendly') {
    const mostProductive = days.reduce((max, d) => 
      d.grand_total.total_seconds > max.grand_total.total_seconds ? d : max, days[0]);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      [new Date(mostProductive.range.date).getDay()];
    headingText = `📈 Last Week, my most productive day was ${dayName}`;
  }

  const top_padding = 22.5;
  const barWidth = 30;
  const spacing = 15;
  const titleHeight = hide_title ? 0 : 14;
  const chartTop = top_padding + titleHeight + 10;
  const chartHeight = 60;
  const chartBottom = 60;
  const chartBase = chartTop + chartHeight;
  const radar_padding = 80;
  let height = chartBase + chartBottom;
  if (chart_type === 'radar') {
    height += radar_padding;
  }
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
            blocks.push(`<text x="${x + barWidth / 2}" y="${y - 4}" font-size="9" text-anchor="middle" fill="#${text_color}">${shortTime}</text>`);
          }

          const dayName = weekdayNames[new Date(d.range.date).getDay()];
          blocks.push(`<text x="${x + barWidth / 2}" y="${chartBase + 12}" font-size="10" text-anchor="middle" fill="#${text_color}">${dayName}</text>`);

          if (!hide_percentage) {
            blocks.push(`<text x="${x + barWidth / 2}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}">${pct}%</text>`);
          }

          return blocks.join('\n');
        });
      }
      case 'line': {
        const curved = typeof chart_curved_line === 'string'
          ? chart_curved_line === 'true'
          : !!chart_curved_line;

        const points = days.map((d, i) => {
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const x = i * (barWidth + spacing) + 30 + barWidth / 2;
          const yVal = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          const y = chartBase - yVal;
          return { x, y, seconds, date: d.range.date, pct };
        });

        let pathD = '';

        if (curved && points.length > 1) {
          pathD += `M ${points[0].x} ${points[0].y} `;
          for (let i = 1; i < points.length; i++) {
            const midX = (points[i - 1].x + points[i].x) / 2;
            const midY = (points[i - 1].y + points[i].y) / 2;
            pathD += `Q ${points[i - 1].x} ${points[i - 1].y}, ${midX} ${midY} `;
          }
          pathD += `T ${points[points.length - 1].x} ${points[points.length - 1].y}`;
        } else {
          pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        }

        const circles = points.map(p =>
          `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#${chart_color}" />`
        );

        const labels = points.map((p) => {
          const shortTime = formatShortTime(p.seconds);
          const dayName = weekdayNames[new Date(p.date).getDay()];
          const timeLabel = !hide_time
            ? `<text x="${p.x}" y="${p.y - 6}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.8">${shortTime}</text>`
            : '';
          const dayLabel = `<text x="${p.x}" y="${chartBase + 12}" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${dayName}</text>`;
          const pctLabel = !hide_percentage
            ? `<text x="${p.x}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${p.pct}%</text>`
            : '';
          return `${timeLabel}\n${dayLabel}\n${pctLabel}`;
        });

        return [
          `<path d="${pathD}" fill="none" stroke="#${chart_color}" stroke-width="2" />`,
          ...circles,
          ...labels
        ];
      }
      case 'area': {
        const curved = typeof chart_curved_line === 'string'
          ? chart_curved_line === 'true'
          : !!chart_curved_line;

        const points = days.map((d, i) => {
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const x = i * (barWidth + spacing) + 30 + barWidth / 2;
          const yVal = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          const y = chartBase - yVal;
          return { x, y, seconds, date: d.range.date, pct };
        });

        let linePath = '';
        if (curved && points.length > 1) {
          linePath += `M ${points[0].x} ${points[0].y} `;
          for (let i = 1; i < points.length; i++) {
            const midX = (points[i - 1].x + points[i].x) / 2;
            const midY = (points[i - 1].y + points[i].y) / 2;
            linePath += `Q ${points[i - 1].x} ${points[i - 1].y}, ${midX} ${midY} `;
          }
          linePath += `T ${points[points.length - 1].x} ${points[points.length - 1].y}`;
        } else {
          linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        }

        const areaPath = `
          ${linePath}
          L ${points[points.length - 1].x} ${chartBase}
          L ${points[0].x} ${chartBase}
          Z
        `;

        const circles = points.map(p =>
          `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#${chart_color}" />`
        );

        const labels = points.map((p) => {
          const shortTime = formatShortTime(p.seconds);
          const dayName = weekdayNames[new Date(p.date).getDay()];
          const timeLabel = !hide_time
            ? `<text x="${p.x}" y="${p.y - 6}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.8">${shortTime}</text>`
            : '';
          const dayLabel = `<text x="${p.x}" y="${chartBase + 12}" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${dayName}</text>`;
          const pctLabel = !hide_percentage
            ? `<text x="${p.x}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${p.pct}%</text>`
            : '';
          return `${timeLabel}\n${dayLabel}\n${pctLabel}`;
        });

        return [
          `<path d="${areaPath.trim()}" fill="#${chart_color}" fill-opacity="0.2" />`,
          `<path d="${linePath.trim()}" fill="none" stroke="#${chart_color}" stroke-width="2" />`,
          ...circles,
          ...labels
        ];
      }
      case 'radar': {
        const cx = (chartWidth + 48) / 2;
        const cy = chartTop + chartHeight / 2 + radar_padding / 1.5;
        const radius = Math.min(chartHeight, chartWidth) / 0.8; 
        const angleStep = (2 * Math.PI) / days.length;

        const points = days.map((d, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const r = maxSeconds ? (seconds / maxSeconds) * radius : 0;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return { x, y, angle, seconds, date: d.range.date, pct };
        });

        const radarPath = points.map((p, i) =>
          `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ') + ' Z';

        const grid = [];
        const levels = 4;
        for (let l = 1; l <= levels; l++) {
          const r = (l / levels) * radius;
          const path = [];
          for (let i = 0; i < days.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            path.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
          }
          grid.push(`<path d="${path.join(' ')} Z" fill="none" stroke="#${darkenColor(bg_color, 80)}" stroke-dasharray="2,2" stroke-width="0.5"/>`);
        }

        const axisLines = days.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#${darkenColor(bg_color, 80)}" stroke-width="0.5"/>`;
        });

        const labels = days.map((d, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelDist = radius + 12;
          const x = cx + labelDist * Math.cos(angle);
          const y = cy + labelDist * Math.sin(angle);
          const dayName = weekdayNames[new Date(d.range.date).getDay()];
          return `<text x="${x}" y="${y}" font-size="10" text-anchor="middle" alignment-baseline="middle" fill="#${text_color}">${dayName}</text>`;
        });

        const dataLabels = !hide_time || !hide_percentage
          ? points.map(p => {
              const time = !hide_time ? formatShortTime(p.seconds) : '';
              const pct = !hide_percentage ? `${p.pct}%` : '';
              const combined = [time, pct].filter(Boolean).join(' • ');
              const lx = p.x + 4;
              const ly = p.y - 4;
              return `<text x="${lx}" y="${ly}" font-size="7" fill="#${text_color}" fill-opacity="0.8">${combined}</text>`;
            })
          : [];

        return [
          ...grid,
          ...axisLines,
          `<polygon points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="#${chart_color}" fill-opacity="0.2" stroke="#${chart_color}" stroke-width="2"/>`,
          ...labels,
          ...dataLabels
        ];
      }
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
    ? `<text x="${chartWidth / 2 + 20}" y="${top_padding}" font-size="14" text-anchor="middle" fill="#${text_color}" font-weight="bold">${headingText}</text>`
    : '';

  const centeredTotal = !hide_total
    ? `<text x="${chartWidth / 2 + 20}" y="${height - 10}" font-size="12" text-anchor="middle" fill="#${text_color}"><tspan font-weight="bold">Total:</tspan> ${totalTimeText}</text>`
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