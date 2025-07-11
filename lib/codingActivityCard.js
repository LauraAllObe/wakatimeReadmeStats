import { hierarchy, pack } from 'd3-hierarchy';

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
    const getDay = d => new Date(d.range.date + 'T00:00:00Z').getUTCDay();
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

function isDarkColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  // Perceived brightness (YIQ formula)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

function darkenColor(hex, amount = 120) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, r - amount),
    Math.max(0, g - amount),
    Math.max(0, b - amount)
  );
}

function lightenColor(hex, amount = 120) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, r + amount),
    Math.min(255, g + amount),
    Math.min(255, b + amount)
  );
}

function invertColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(255 - r, 255 - g, 255 - b);
}

function catmullRom2bezier(points, minY = -Infinity, maxY = Infinity) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;

    // Clamp control point Y values
    cp1y = Math.min(Math.max(cp1y, minY), maxY);
    cp2y = Math.min(Math.max(cp2y, minY), maxY);

    result.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return `M ${points[0].x},${points[0].y} ` + result.join(' ');
}

function varyColor(baseHex, variance = 30) {
  const [r, g, b] = hexToRgb(baseHex);
  const rand = () => Math.floor((Math.random() - 0.5) * variance);
  return rgbToHex(
    Math.min(255, Math.max(0, r + rand())),
    Math.min(255, Math.max(0, g + rand())),
    Math.min(255, Math.max(0, b + rand()))
  );
}

function getSafeDayName(dateStr) {
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const readableDayNames = {
    su: 'Sun', mo: 'Mon', tu: 'Tue', we: 'Wed',
    th: 'Thu', fr: 'Fri', sa: 'Sat'
  };

  if (readableDayNames[dateStr?.toLowerCase?.()]) {
    return readableDayNames[dateStr.toLowerCase()];
  }

  const parsed = new Date(dateStr + 'T00:00:00Z');
  const index = isNaN(parsed.getTime()) ? -1 : parsed.getUTCDay();
  return weekdayNames[index] ?? '—';
}

function generateYAxisElements(maxSeconds, chartTop, chartBase, chartHeight, text_color, chartWidth, chart_type, y_axis_label, leftPadding) {
  const ticks = 4;
  const lines = [];
  const labels = [];

  let xTickStart = leftPadding;     // Start of tick lines
  const xLabel = leftPadding - 8;         // Position of tick labels
  let xAxisEnd = chartWidth + 56;

  if(chart_type === 'line' || chart_type === 'area')
  {
    xTickStart += 15;
    xAxisEnd -= 15;
  }

  for (let i = 0; i <= ticks; i++) {
    const val = (maxSeconds / ticks) * i;
    const y = chartBase - (val / maxSeconds) * chartHeight;
    const label = formatShortTime(val);

    lines.push(`<line x1="${xTickStart}" y1="${y}" x2="${xAxisEnd}" y2="${y}" stroke="#${text_color}" stroke-width="0.5" stroke-dasharray="2,2"/>`);
    labels.push(`<text x="${xLabel}" y="${y + 3}" font-size="9" text-anchor="end" fill="#${text_color}">${label}</text>`);
  }

  if (y_axis_label && chart_type !== 'radar') {
    const labelX = 22; // fixed position for vertical text
    const labelY = chartTop + chartHeight / 2;
    labels.push(
      `<text x="${labelX}" y="${labelY}" font-size="9" text-anchor="middle" transform="rotate(-90, ${labelX}, ${labelY})" fill="#${text_color}">Time</text>`
    );
  }

  return [...lines, ...labels];
}

export async function getCodingActivityCard ({
    api_key,
    username,
    text_color,
    chart_color,
    chart_type,
    bg_color,
    chart_curved_line,
    start_day,
    heading_type,
    custom_heading,
    mixed_colors,
    hide_legend,
    hide_total,
    hide_time,
    hide_percentage,
    hide_title,
    y_axis,
    y_axis_label,
    custom_days,
  }) {
  chart_color = chart_color.replace(/^#/, '');
  text_color = text_color.replace(/^#/, '');
  const apiKey = api_key ?? '';
  if (!apiKey || apiKey === '') throw new Error('Missing WAKATIME_API_KEY');

  const res = await fetch(
    `https://wakatime.com/api/v1/users/${username}/summaries?range=last_7_days`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
      }
    }
  );

  const json = await res.json();
  let days = custom_days || json.data;
  if (!days || days.length === 0) {
    throw new Error('No 7-day summary data available.');
  }

  if (start_day && start_day !== '-7') {
    days = reorderDays(days, start_day);
  }

  const totalSeconds = days.reduce((sum, d) => sum + d.grand_total.total_seconds, 0);
  const maxSeconds = Math.max(...days.map(d => d.grand_total.total_seconds));

  // --- Friendly heading
  let headingText;
  if (heading_type === 'custom') {
    headingText = custom_heading;
  } else if (heading_type === 'friendly') {
    const mostProductive = days.reduce((a, b) =>
      b.grand_total.total_seconds > a.grand_total.total_seconds ? b : a
    );
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      [new Date(mostProductive.range.date + 'T00:00:00Z').getUTCDay()];
    headingText = `This week, my most productive day was ${dayName}`;
  } else {
    headingText = 'This Week\'s Coding Time';
  }

  const hasYAxis = y_axis && ['bar', 'line', 'area'].includes(chart_type);
  const hasYAxisLabel = y_axis_label && ['bar', 'line', 'area'].includes(chart_type);
  const leftPadding = (hasYAxis || hasYAxisLabel ? 70 : 0);
  const leftPaddingNoY = (!hasYAxis && !hasYAxisLabel ? 30 : 0) 
  const top_padding = 22.5;
  const barWidth = 30;
  const spacing = 15;
  const titleHeight = hide_title ? 0 : 14;
  const chartTop = top_padding + titleHeight + 10;
  const chartHeight = 60;
  const chartBottom = 60;
  const chartBase = chartTop + chartHeight;
  const radar_padding = 110;
  const bubble_padding = 35;
  let height = chartBase + chartBottom;
  if (chart_type === 'radar') {
    height += radar_padding;
  }
  if (chart_type === 'bubble') {
    height -= bubble_padding;
  }
  const chartWidth = days.length * (barWidth + spacing);
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function getMixedColor(index) {
    const useLighten = isDarkColor(bg_color);
    const adjustColor = useLighten ? lightenColor : darkenColor;
    
    return mixed_colors && index > 0
      ? adjustColor(chart_color, 20 + index * 10)
      : chart_color;
  }

  const chartSvgBlocks = (() => {
    switch (chart_type) {
      case 'bar': {
        const barBlocks = days.map((d, i) => {
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          let barHeight = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          if (barHeight === 0 && seconds === 0) {
            barHeight = 1.5;
          }
          const x = i * (barWidth + spacing) + leftPadding + leftPaddingNoY;
          const y = chartBase - barHeight;

          const blocks = [];

          const fill = getMixedColor(i);
          blocks.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#${fill}" rx="3" ry="3" />`);

          const shortTime = formatShortTime(seconds);
          if (!hide_time) {
            blocks.push(`<text x="${x + barWidth / 2}" y="${y - 4}" font-size="9" text-anchor="middle" fill="#${text_color}">${shortTime}</text>`);
          }

          const dayName = getSafeDayName(d.range.date);
          blocks.push(`<text x="${x + barWidth / 2}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}">${dayName}</text>`);

          if (!hide_percentage) {
            blocks.push(`<text x="${x + barWidth / 2}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}">${pct}%</text>`);
          }

          return blocks.join('\n');
        });

        const yAxis = y_axis && ['bar', 'line', 'area'].includes(chart_type)
          ? generateYAxisElements(maxSeconds, chartTop, chartBase, chartHeight, text_color, chartWidth, chart_type, y_axis_label, leftPadding)
          : [];

        return [...yAxis, ...barBlocks];
      }
      case 'line': {
        const curved = typeof chart_curved_line === 'string'
          ? chart_curved_line === 'true'
          : !!chart_curved_line;

        const points = days.map((d, i) => {
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const x = i * (barWidth + spacing)  + leftPadding + leftPaddingNoY + barWidth / 2;
          const yVal = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          const y = chartBase - yVal;
          return { x, y, seconds, date: d.range.date, pct };
        });

        let pathD = '';

        if (curved && points.length > 1) {
          pathD = catmullRom2bezier(points, chartBase - chartHeight, chartBase);
        } else {
          pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        }

        const circles = points.map((p, i) =>
          `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#${getMixedColor(i)}" />`
        );

        const yAxis = y_axis && ['bar', 'line', 'area'].includes(chart_type)
          ? generateYAxisElements(maxSeconds, chartTop, chartBase, chartHeight, text_color, chartWidth, chart_type, y_axis_label, leftPadding)
          : [];

        const labels = points.map((p, i) => {
          const shortTime = formatShortTime(p.seconds);
          const dayName = getSafeDayName(days[i].range.date);
          const timeLabel = !hide_time
            ? `<text x="${p.x}" y="${p.y - 6}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.8">${shortTime}</text>`
            : '';
          const dayLabel = `<text x="${p.x}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${dayName}</text>`;
          const pctLabel = !hide_percentage
            ? `<text x="${p.x}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${p.pct}%</text>`
            : '';
          return `${timeLabel}\n${dayLabel}\n${pctLabel}`;
        });

        return [
          ...yAxis,
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
          const x = i * (barWidth + spacing)  + leftPadding + leftPaddingNoY + barWidth / 2;
          const yVal = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          const y = chartBase - yVal;
          return { x, y, seconds, date: d.range.date, pct };
        });

        let linePath = '';
        if (curved && points.length > 1) {
          linePath = catmullRom2bezier(points, chartBase - chartHeight, chartBase);
        } else {
          linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        }

        const areaPath = `
          ${linePath}
          L ${points[points.length - 1].x} ${chartBase}
          L ${points[0].x} ${chartBase}
          Z
        `;

        const circles = points.map((p, i) =>
          `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#${getMixedColor(i)}" />`
        );

        const yAxis = y_axis && ['bar', 'line', 'area'].includes(chart_type)
          ? generateYAxisElements(maxSeconds, chartTop, chartBase, chartHeight, text_color, chartWidth, chart_type, y_axis_label, leftPadding)
          : [];

        const labels = points.map((p, i) => {
          const shortTime = formatShortTime(p.seconds);
          const dayName = getSafeDayName(days[i].range.date);
          const timeLabel = !hide_time
            ? `<text x="${p.x}" y="${p.y - 6}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.8">${shortTime}</text>`
            : '';
          const dayLabel = `<text x="${p.x}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${dayName}</text>`;
          const pctLabel = !hide_percentage
            ? `<text x="${p.x}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${p.pct}%</text>`
            : '';
          return `${timeLabel}\n${dayLabel}\n${pctLabel}`;
        });

        return [
          ...yAxis,
          `<path d="${areaPath.trim()}" fill="#${chart_color}" fill-opacity="0.2" />`,
          `<path d="${linePath.trim()}" fill="none" stroke="#${chart_color}" stroke-width="2" />`,
          ...circles,
          ...labels
        ];
      }
      case 'radar': {
        const cx = (chartWidth + 48) / 2;
        const cy = chartTop + chartHeight / 2 + radar_padding / 1.7;
        const radius = Math.min(chartHeight, chartWidth) / 0.7;
        const angleStep = (2 * Math.PI) / days.length;
        const useLighten = isDarkColor(bg_color);
        const adjustColor = useLighten ? darkenColor : lightenColor;
        const adjustedColor = adjustColor(text_color, 120);

        const points = days.map((d, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const r = maxSeconds ? (seconds / maxSeconds) * radius : 0;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return { x, y, angle, seconds, date: d.range.date, pct };
        });

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
          grid.push(`<path d="${path.join(' ')} Z" fill="none" stroke="#${adjustedColor}" stroke-dasharray="2,2" stroke-width="0.5"/>`);
        }

        const axisLines = days.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#${adjustedColor}" stroke-width="0.5"/>`;
        });

        const labels = days.map((d, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelDist = radius + 12;
          const x = cx + labelDist * Math.cos(angle);
          const y = cy + labelDist * Math.sin(angle);
          const dayName = getSafeDayName(d.range.date);
          return `<text x="${x}" y="${y}" font-size="10" text-anchor="middle" alignment-baseline="middle" fill="#${text_color}">${dayName}</text>`;
        });

        
        let radarYAxis = [];
        if (y_axis) {
          const angle = Math.PI / 14; // 30° downward right from center (instead of 0° right)
          const labelAngleDeg = 77;  // vertical downward

          for (let i = 0; i <= 4; i++) {
            const val = (maxSeconds / 4) * i;
            const r = (val / maxSeconds) * radius;

            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);

            radarYAxis.push(`<circle cx="${x}" cy="${y}" r="0.8" fill="#${text_color}"/>`);

            if (y_axis_label || i === 0 || i === 4) {
              if (i === 0) continue;
              const label = formatShortTime(val);
              const labelYOffset = 18 + r * 0.05;
              const labelY = y - labelYOffset;
              const labelXOffset = r * 0
              const labelX = x - 2 - labelXOffset;

              radarYAxis.push(`
                <text x="${labelX}" y="${labelY}" font-size="8" text-anchor="start"
                      transform="rotate(${labelAngleDeg}, ${labelX}, ${labelY})"
                      fill="#${text_color}">${label}</text>
              `);
            }
          }
        }

        // Stylized legend like ESPN
        const legendYOffset = 60;
        const legendLineHeight = 24;
        const legendCols = 2;
        const legendColWidth = 180;
        const centerOffsetX = ((chartWidth + 100) - legendCols * legendColWidth) / 2;

        // --- Calculate max width for legend pill
        const allPillTexts = days.map(d => {
          const time = formatShortTime(d.grand_total.total_seconds);
          const pct = ((d.grand_total.total_seconds / totalSeconds) * 100).toFixed(1) + '%';
          return `${time} (${pct})`;
        });
        const maxPillText = allPillTexts.reduce((a, b) => (a.length > b.length ? a : b));
        const uniformPillWidth = maxPillText.length * 5 + 8; // consistent size for all

        const legendItems = hide_legend
          ? [] // If hidden, render nothing
          : days.map((d, i) => {
              const shortTime = formatShortTime(d.grand_total.total_seconds);
              const pct = ((d.grand_total.total_seconds / totalSeconds) * 100).toFixed(1) + '%';
              const dayName = getSafeDayName(d.range.date);
              const x = centerOffsetX + (i % legendCols) * legendColWidth;
              const y = chartBase + radar_padding + legendYOffset + Math.floor(i / legendCols) * legendLineHeight;

              const pillText = `${shortTime} (${pct})`;
              const pillX = x + dayName.length * 12 + 12;

              const ratio = d.grand_total.total_seconds / maxSeconds;
              const opacity = (0.1 + 0.6 * ratio).toFixed(2); // range: 0.1–0.7 or 1.0

              return `
                <text x="${x}" y="${y}" font-size="10" font-weight="bold" fill="#${text_color}">
                  ${dayName}:
                </text>
                <rect x="${pillX}" y="${y - 10}" width="${uniformPillWidth}" height="14" fill="#${chart_color}" fill-opacity="${opacity}" />
                <text x="${pillX + uniformPillWidth / 2}" y="${y + 1}" font-size="9" text-anchor="middle" fill="#${text_color}">
                  ${pillText}
                </text>
              `;
            });

        const legendHeight = Math.ceil(days.length / legendCols) * legendLineHeight + legendYOffset;
        if (!hide_legend) {
          height = chartBase + radar_padding + legendHeight + 20;
        }

        return [
          ...grid,
          ...axisLines,
          `<polygon points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="#${chart_color}" fill-opacity="0.2" stroke="#${chart_color}" stroke-width="2"/>`,
          ...labels,
          ...radarYAxis,
          ...legendItems
        ];
      }
      case 'bubble': {
        const data = {
          children: days.map((d, i) => ({
            value: d.grand_total.total_seconds,
            index: i
          }))
        };

        const root = hierarchy(data)
          .sum(d => d.value)
          .sort((a, b) => b.value - a.value);

        const chartSize = Math.max(chartWidth, 240);
        const packLayout = pack()
          .size([chartSize, chartSize * 0.75])
          .padding(2);

        const packedRoot = packLayout(root);
        const leaves = packedRoot.leaves();
        const bubbleYOffset = 25;
        leaves.forEach(node => {
          node.y += bubbleYOffset;
        });

        const maxY = Math.max(...leaves.map(n => n.y + n.r));
        const actualBubbleHeight = maxY;
        const maxBubbleChartHeight = chartBase - chartTop + 220;

        // Apply vertical scaling if overflow
        let scaleY = 1;
        if (actualBubbleHeight > maxBubbleChartHeight) {
          scaleY = maxBubbleChartHeight / actualBubbleHeight;
          leaves.forEach(node => {
            node.y = chartTop + (node.y - chartTop) * scaleY;
            node.r *= scaleY;
          });
        }

        height = maxY + 20;

        // --- Centering offset ---
        const minX = Math.min(...leaves.map(n => n.x - n.r));
        const maxX = Math.max(...leaves.map(n => n.x + n.r));
        const bubbleWidth = maxX - minX;
        const svgCenter = (chartWidth + 48) / 2;
        const bubbleCenter = minX + bubbleWidth / 2;
        const xOffset = svgCenter - bubbleCenter;

        const elements = [];
        const legendItems = [];

        const legendCols = 2;
        const legendColWidth = 190;
        const legendCircleOffset = 12;
        const legendTextOffset = 24;
        const legendYOffset = 40;
        const legendLineHeight = 20;
        const centerOffsetX = ((chartWidth + 100) - legendCols * legendColWidth) / 2;

        leaves.forEach((node, i) => {
          const dayIndex = node.data.index;
          const d = days[dayIndex];
          const seconds = d.grand_total.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const shortTime = formatShortTime(seconds);
          const dayName = getSafeDayName(d.range.date);
          const color = varyColor(chart_color);

          elements.push(`<circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="#${color}" fill-opacity="0.85" />`);

          if (!hide_legend) {
            const x = centerOffsetX + (i % legendCols) * legendColWidth;
            const y = maxY + 30 + Math.floor(i / legendCols) * legendLineHeight;

            legendItems.push(`
              <circle cx="${x + legendCircleOffset}" cy="${y}" r="6" fill="#${color}" />
              <text x="${x + legendTextOffset}" y="${y + 3}" font-size="10" font-weight="bold" fill="#${text_color}">
                ${dayName}:
              </text>
              <text x="${x + legendTextOffset + 50}" y="${y + 3}" font-size="10" fill="#${text_color}">
                ${shortTime} (${pct}%)
              </text>
            `);
          }
        });

        const bubbleGroup = `<g transform="translate(${xOffset}, 0)">\n${elements.join('\n')}\n</g>`;

        if (!hide_legend) {
          const legendHeight = Math.ceil(days.length / legendCols) * legendLineHeight + legendYOffset;
          height += legendHeight;
        }

        return [
          bubbleGroup,
          ...legendItems
        ];
      }
      case 'donut': {
        const centerX = (chartWidth + 48) / 2;
        const centerY = chartTop + chartHeight + 30;
        const outerRadius = 80;
        const innerRadius = 40;
        const outerLabelRadius = outerRadius + 16;
        const innerLabelRadius1 = (outerRadius + innerRadius) / 2 - 8; // for time
        const innerLabelRadius2 = (outerRadius + innerRadius) / 2 + 4; // for percentage
        const minLabelAngle = Math.PI / 10; // ~18 degrees
        let startAngle = 0;

        const elements = [];
        const defs = [];

        days.forEach((d, i) => {
          const seconds = d.grand_total.total_seconds;
          if (seconds === 0) return;

          const pct = seconds / totalSeconds;
          const angle = pct * 2 * Math.PI;
          const endAngle = startAngle + angle;
          const largeArcFlag = angle > Math.PI ? 1 : 0;
          const color = getMixedColor(i);

          const x1 = centerX + outerRadius * Math.cos(startAngle);
          const y1 = centerY + outerRadius * Math.sin(startAngle);
          const x2 = centerX + outerRadius * Math.cos(endAngle);
          const y2 = centerY + outerRadius * Math.sin(endAngle);
          const x3 = centerX + innerRadius * Math.cos(endAngle);
          const y3 = centerY + innerRadius * Math.sin(endAngle);
          const x4 = centerX + innerRadius * Math.cos(startAngle);
          const y4 = centerY + innerRadius * Math.sin(startAngle);

          elements.push(`
            <path d="
              M ${x1} ${y1}
              A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
              L ${x3} ${y3}
              A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}
              Z
            " fill="#${color}" />
          `);

          const dayName = getSafeDayName(d.range.date);
          const shortTime = formatShortTime(seconds);
          const pctText = (pct * 100).toFixed(1) + '%';

          // Day label (outer)
          const percentage = pct * 100;
          if (percentage >= 1) {
            const dx1 = centerX + outerLabelRadius * Math.cos(startAngle);
            const dy1 = centerY + outerLabelRadius * Math.sin(startAngle);
            const dx2 = centerX + outerLabelRadius * Math.cos(endAngle);
            const dy2 = centerY + outerLabelRadius * Math.sin(endAngle);
            const dayPathId = `dayPath${i}`;

            defs.push(`
              <path id="${dayPathId}" fill="none" d="
                M ${dx1} ${dy1}
                A ${outerLabelRadius} ${outerLabelRadius} 0 ${largeArcFlag} 1 ${dx2} ${dy2}
              " />
            `);

            const anchor = percentage < 5 ? 'start' : 'middle';
            const offset = percentage < 5 ? '5%' : '50%';

            elements.push(`
              <text font-size="9" fill="#${text_color}">
                <textPath href="#${dayPathId}" startOffset="${offset}" text-anchor="${anchor}">${dayName}</textPath>
              </text>
            `);
          }

          // Time label (inner curve 1)
          if (!hide_time && angle >= minLabelAngle) {
            const t1x = centerX + innerLabelRadius1 * Math.cos(startAngle);
            const t1y = centerY + innerLabelRadius1 * Math.sin(startAngle);
            const t2x = centerX + innerLabelRadius1 * Math.cos(endAngle);
            const t2y = centerY + innerLabelRadius1 * Math.sin(endAngle);
            const timePathId = `timePath${i}`;
            defs.push(`
              <path id="${timePathId}" fill="none" d="
                M ${t1x} ${t1y}
                A ${innerLabelRadius1} ${innerLabelRadius1} 0 ${largeArcFlag} 1 ${t2x} ${t2y}
              " />
            `);
            elements.push(`
              <text font-size="8" fill="#${text_color}">
                <textPath href="#${timePathId}" startOffset="50%" text-anchor="middle">${shortTime}</textPath>
              </text>
            `);
          }

          // Percentage label (inner curve 2)
          if (!hide_percentage && angle >= minLabelAngle) {
            const p1x = centerX + innerLabelRadius2 * Math.cos(startAngle);
            const p1y = centerY + innerLabelRadius2 * Math.sin(startAngle);
            const p2x = centerX + innerLabelRadius2 * Math.cos(endAngle);
            const p2y = centerY + innerLabelRadius2 * Math.sin(endAngle);
            const pctPathId = `pctPath${i}`;
            defs.push(`
              <path id="${pctPathId}" fill="none" d="
                M ${p1x} ${p1y}
                A ${innerLabelRadius2} ${innerLabelRadius2} 0 ${largeArcFlag} 1 ${p2x} ${p2y}
              " />
            `);
            elements.push(`
              <text font-size="8" fill="#${text_color}">
                <textPath href="#${pctPathId}" startOffset="50%" text-anchor="middle">${pctText}</textPath>
              </text>
            `);
          }

          startAngle = endAngle;
        });

        // Add space below for total
        height += 110;

        if (defs.length > 0) {
          elements.unshift(`<defs>${defs.join('\n')}</defs>`);
        }

        return elements;
      }
      case 'spiral': {
        const centerX = (chartWidth + 34) / 2;
        const centerY = chartTop + chartHeight + 60;

        const totalSpiralPoints = 360;
        const totalTurns = 3;
        const angleIncrement = (2 * Math.PI * totalTurns) / totalSpiralPoints;
        const scaleX = 1.3;
        const scaleY = 0.5;
        const baseRadius = 30;
        const spacing = 24;
        const pinHeight = 85;

        const spiralPathPoints = [];
        for (let i = 0; i < totalSpiralPoints; i++) {
          const angle = i * angleIncrement;
          const radius = baseRadius + spacing * angle / (2 * Math.PI);
          const x = centerX + radius * Math.cos(angle) * scaleX;
          const y = centerY + radius * Math.sin(angle) * scaleY;
          spiralPathPoints.push({ x, y });
        }

        const elements = [];

        // Spiral path with 3D stroke variation
        for (let i = 0; i < spiralPathPoints.length - 1; i++) {
          const p1 = spiralPathPoints[i];
          const p2 = spiralPathPoints[i + 1];

          const t = i / (spiralPathPoints.length - 1);
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const angle = Math.atan2(dy, dx);
          const orientation = Math.abs(Math.sin(angle));

          const strokeW = 2 + 3 * t + 7.5 * Math.pow(orientation, 1);

          // Extend the line slightly to overlap with next
          const overshoot = 0.5;
          const dist = Math.hypot(dx, dy);
          const ux = dx / dist;
          const uy = dy / dist;
          const x1 = p1.x - ux * overshoot;
          const y1 = p1.y - uy * overshoot;
          const x2 = p2.x + ux * overshoot;
          const y2 = p2.y + uy * overshoot;

          elements.push(`
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                  stroke="#${chart_color}"
                  stroke-width="${strokeW.toFixed(2)}"
                  stroke-linecap="round"
                  stroke-opacity="1" />
          `);
        }

        const stepInterval = Math.round(totalSpiralPoints / (days.length + 1));
        const labels = [];
        const minRadius = 1.8;
        const maxRadius = 5.2;

        // Label each day
        days.forEach((d, i) => {
          const spiralIndex = i * stepInterval;
          const point = spiralPathPoints[spiralIndex];
          if (!point) return;

          let x = point.x;
          let y = point.y;
          if (i === 2) {
            x -= 19;
            y -= -1;
          }
          const labelY = y - pinHeight;

          const seconds = d.grand_total.total_seconds;
          const ratio = seconds / maxSeconds;
          const radius = minRadius + (maxRadius - minRadius) * ratio;
          const useLighten = isDarkColor(bg_color);
          const adjustColor = useLighten ? darkenColor : lightenColor;
          const adjustedColor = adjustColor(chart_color, 60);

          const dotColor = adjustedColor;
          const lineColor = adjustedColor;

          const shortTime = formatShortTime(seconds);
          const pct = (ratio * 100).toFixed(1) + '%';
          const day = getSafeDayName(d.range.date);

          elements.push(`<circle cx="${x}" cy="${y}" r="${radius.toFixed(2)}" fill="#${dotColor}" />`);
          elements.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${labelY}" stroke="#${lineColor}" stroke-width="1.2" />`);

          labels.push(`
            <text x="${x}" y="${labelY - 8}" font-size="9.5" text-anchor="middle" fill="#${text_color}">${day}</text>
            ${
              (!hide_time || !hide_percentage)
                ? `<text transform="rotate(-90, ${x + 12}, ${labelY + 12})"
                          x="${x + 10}" y="${labelY + 10}"
                          font-size="8.5" text-anchor="end" fill="#${text_color}">
                      ${[!hide_time ? shortTime : null, !hide_percentage ? pct : null].filter(Boolean).join(' • ')}
                    </text>`
                : ''
            }
          `);
        });

        // Add current marker at end
        const nowPoint = spiralPathPoints[spiralPathPoints.length - 1];
        const nowX = nowPoint.x;
        const nowY = nowPoint.y;
        const nowLabelY = nowY - pinHeight;

        const nowRatio = totalSeconds / (maxSeconds * days.length); // Approximate ratio
        const nowRadius = minRadius + (maxRadius - minRadius) * nowRatio;
        const useLighten = isDarkColor(bg_color);
        const adjustColor = useLighten ? darkenColor : lightenColor;
        const adjustedColor = adjustColor(chart_color, 60);

        const nowDotColor = adjustedColor;

        elements.push(`<circle cx="${nowX}" cy="${nowY}" r="${nowRadius.toFixed(2)}" fill="#${nowDotColor}" />`);
        elements.push(`<line x1="${nowX}" y1="${nowY}" x2="${nowX}" y2="${nowLabelY}" stroke="#${adjustedColor}" stroke-width="1.2" />`);
        labels.push(`
          <text x="${nowX}" y="${nowLabelY - 8}" font-size="9.5" text-anchor="middle" fill="#${text_color}">Now</text>
        `);

        const spiralBottom = spiralPathPoints[spiralPathPoints.length - 1].y + 100;
        height = Math.max(height, spiralBottom);

        return [
          `<g>${elements.join('\n')}</g>`,
          `<g>${labels.join('\n')}</g>`
        ];
      }
    }
  })();

  const totalSeconds2 = days.reduce((sum, d) => sum + d.grand_total.total_seconds, 0);

  function formatFullTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const hourPart = h > 0 ? `${h} hr${h > 1 ? 's' : ''}` : '';
    const minutePart = m > 0 ? `${m} min${m > 1 ? 's' : ''}` : '';
    return [hourPart, minutePart].filter(Boolean).join(' ');
  }

  const totalTimeText = formatFullTime(totalSeconds2);

  const isFriendly = (heading_type === 'friendly' || (heading_type === 'custom' && custom_heading.length > 26));
  const headingFontSize = isFriendly ? 12 : 14;

  const xCenter = chart_type === 'radar'
  ? chartWidth / 2 + 20
  : leftPadding/2 + chartWidth / 2 + 20;

  const title = !hide_title
    ? `<text x="${xCenter}" y="${top_padding}" font-size="${headingFontSize}" text-anchor="middle" fill="#${text_color}" font-weight="bold">${headingText}</text>`
    : '';

  const centeredTotal = !hide_total
    ? `<text x="${xCenter}" y="${height - 10}" font-size="12" text-anchor="middle" fill="#${text_color}"><tspan font-weight="bold">Total:</tspan> ${totalTimeText}</text>`
    : '';

  return {
    content: `
      ${title}
      ${chartSvgBlocks.join('\n')}
      ${centeredTotal}
    `,
    height,
    width:
      chart_type === 'radar'
        ? Math.max(chartWidth, 300) + 48
        : Math.max(chartWidth, 300) + 48 + leftPadding
  };
}