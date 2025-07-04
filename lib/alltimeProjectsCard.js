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

function darkenColor(hex, amount = 120) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, r - amount),
    Math.max(0, g - amount),
    Math.max(0, b - amount)
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

    lines.push(`<line x1="${xTickStart}" y1="${y}" x2="${xAxisEnd}" y2="${y}" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2,2"/>`);
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

export async function getAlltimeProjectsCard(params) {
  const {
    username,
    text_color,
    chart_color,
    chart_type,
    bg_color,
    chart_curved_line,
    heading_type,
    mixed_colors,
    num_projs,
    hide_legend,
    hide_total,
    hide_time,
    hide_percentage,
    hide_title,
    y_axis,
    y_axis_label,
  } = params;
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

  const res = await fetch(
    `https://wakatime.com/api/v1/users/${username}/stats/all_time`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
      }
    }
  );

  const json = await res.json();
  if (!json.data || !json.data.projects) {
    throw new Error('No all-time project data available.');
  }
  
  // Limit to top N projects
  const numProjs = parseInt(params.num_projs, 10) || 5;
  const topProjects = json.data.projects
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, numProjs);

  // Extract total and max seconds for normalization
  const totalSeconds = topProjects.reduce((sum, proj) => sum + proj.total_seconds, 0);
  const maxSeconds = Math.max(...topProjects.map(proj => proj.total_seconds));

  // --- Friendly heading
  let headingText;
  if (params.custom_heading) {
    headingText = params.custom_heading;
  } else if (heading_type === 'friendly') {
  const topProj = topProjects[0]?.name || 'Unknown';
    headingText = `My top project is ${topProj}`;
  } else {
    headingText = 'My Top Projects';
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
  const chartWidth = topProjects.length * (barWidth + spacing);

  function getMixedColor(index) {
    return mixed_colors && index > 0
      ? darkenColor(chart_color, 20 + index * 10) // tweak the darkness variation
      : chart_color;
  }

  const chartSvgBlocks = (() => {
    switch (chart_type) {
      case 'bar': {
        const barBlocks = topProjects.map((proj, i) => {
            const seconds = proj.total_seconds;
            const pct = ((seconds / totalSeconds) * 100).toFixed(1);
            let barHeight = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
            if (barHeight === 0 && seconds === 0) {
            barHeight = 1.5;
            }

            const x = i * (barWidth + spacing) + leftPadding + leftPaddingNoY;
            const y = chartBase - barHeight;
            const fill = getMixedColor(i);
            const shortTime = formatShortTime(seconds);

            const blocks = [];

            blocks.push(
            `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#${fill}" rx="3" ry="3" />`
            );

            if (!hide_time) {
            blocks.push(
                `<text x="${x + barWidth / 2}" y="${y - 4}" font-size="9" text-anchor="middle" fill="#${text_color}">${shortTime}</text>`
            );
            }

            blocks.push(
            `<text x="${x + barWidth / 2}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}">${proj.name}</text>`
            );

            if (!hide_percentage) {
            blocks.push(
                `<text x="${x + barWidth / 2}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}">${pct}%</text>`
            );
            }

            return blocks.join('\n');
        });

        const yAxis = y_axis && ['bar', 'line', 'area'].includes(chart_type)
            ? generateYAxisElements(
                maxSeconds,
                chartTop,
                chartBase,
                chartHeight,
                text_color,
                chartWidth,
                chart_type,
                y_axis_label,
                leftPadding
            )
            : [];

        return [...yAxis, ...barBlocks];
      }
      case 'bar_vertical': {
        const rowHeight = 24;
        const barMaxWidth = chartWidth - leftPadding - 40;
        const barBlocks = topProjects.map((proj, i) => {
          const seconds = proj.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const barWidth = maxSeconds ? (seconds / maxSeconds) * barMaxWidth : 0;
          const y = chartTop + i * rowHeight;
          const fill = getMixedColor(i);
          const shortTime = formatShortTime(seconds);

          const blocks = [];

          blocks.push(`<text x="${leftPadding - 8}" y="${y + 9}" font-size="10" text-anchor="end" fill="#${text_color}">${proj.name}</text>`);
          blocks.push(`<rect x="${leftPadding}" y="${y}" width="${barWidth}" height="12" fill="#${fill}" rx="2" ry="2" />`);

          if (!hide_time) {
            blocks.push(`<text x="${leftPadding + barWidth + 6}" y="${y + 9}" font-size="9" fill="#${text_color}">${shortTime}</text>`);
          }

          if (!hide_percentage) {
            blocks.push(`<text x="${leftPadding + barWidth + 60}" y="${y + 9}" font-size="9" fill="#${text_color}">${pct}%</text>`);
          }

          return blocks.join('\n');
        });

        height = topProjects.length * rowHeight + chartTop + 30;

        return [...barBlocks];
      }
      case 'line': {
        const curved = typeof chart_curved_line === 'string'
          ? chart_curved_line === 'true'
          : !!chart_curved_line;

        const points = topProjects.map((proj, i) => {
          const seconds = proj.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const x = i * (barWidth + spacing)  + leftPadding + leftPaddingNoY + barWidth / 2;
          const yVal = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          const y = chartBase - yVal;
          return { x, y, seconds, label: proj.name, pct };
        });

        let pathD = '';

        if (curved && points.length > 1) {
          pathD = linePath = catmullRom2bezier(points, chartBase - chartHeight, chartBase);
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
          const label = p.label;
          const timeLabel = !hide_time
            ? `<text x="${p.x}" y="${p.y - 6}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.8">${shortTime}</text>`
            : '';
          const projLabel = `<text x="${p.x}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${label}</text>`;
          const pctLabel = !hide_percentage
            ? `<text x="${p.x}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${p.pct}%</text>`
            : '';
          return `${timeLabel}\n${projLabel}\n${pctLabel}`;
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

        const points = topProjects.map((proj, i) => {
          const seconds = proj.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const x = i * (barWidth + spacing)  + leftPadding + leftPaddingNoY + barWidth / 2;
          const yVal = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
          const y = chartBase - yVal;
          return { x, y, seconds, label: proj.name, pct };
        });

        let linePath = '';
        if (curved && points.length > 1) {
          linePath = linePath = catmullRom2bezier(points, chartBase - chartHeight, chartBase);
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
          const label = p.label;
          const timeLabel = !hide_time
            ? `<text x="${p.x}" y="${p.y - 6}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.8">${shortTime}</text>`
            : '';
          const projLabel = `<text x="${p.x}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${label}</text>`;
          const pctLabel = !hide_percentage
            ? `<text x="${p.x}" y="${chartBase + 24}" font-size="9" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${p.pct}%</text>`
            : '';
          return `${timeLabel}\n${projLabel}\n${pctLabel}`;
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
        const angleStep = (2 * Math.PI) / topProjects.length;

        const points = topProjects.map((proj, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const seconds = proj.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const r = maxSeconds ? (seconds / maxSeconds) * radius : 0;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return { x, y, angle, seconds, label: proj.name, pct };
        });

        const grid = [];
        const levels = 4;
        for (let l = 1; l <= levels; l++) {
          const r = (l / levels) * radius;
          const path = [];
          for (let i = 0; i < topProjects.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            path.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
          }
          grid.push(`<path d="${path.join(' ')} Z" fill="none" stroke="#${darkenColor(bg_color, 120)}" stroke-dasharray="2,2" stroke-width="0.5"/>`);
        }

        const axisLines = topProjects.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#${darkenColor(bg_color, 120)}" stroke-width="0.5"/>`;
        });

        const labels = topProjects.map((proj, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelDist = radius + 12;
          const x = cx + labelDist * Math.cos(angle);
          const y = cy + labelDist * Math.sin(angle);
          return `<text x="${x}" y="${y}" font-size="10" text-anchor="middle" alignment-baseline="middle" fill="#${text_color}">${proj.name}</text>`;
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
        const allPillTexts = topProjects.map(proj => {
          const time = formatShortTime(proj.total_seconds);
          const pct = ((proj.total_seconds / totalSeconds) * 100).toFixed(1) + '%';
          return `${time} (${pct})`;
        });
        const maxPillText = allPillTexts.reduce((a, b) => (a.length > b.length ? a : b));
        const uniformPillWidth = maxPillText.length * 5 + 8; // consistent size for all

        const legendItems = topProjects.map((proj, i) => {
          const shortTime = formatShortTime(proj.total_seconds);
          const pct = ((proj.total_seconds / totalSeconds) * 100).toFixed(1) + '%';
          const label = proj.name;
          const x = centerOffsetX + (i % legendCols) * legendColWidth;
          const y = chartBase + radar_padding + legendYOffset + Math.floor(i / legendCols) * legendLineHeight;

          const pillText = `${shortTime} (${pct})`;
          const pillX = x + label.length * 12 + 12;

          const ratio = proj.total_seconds / maxSeconds;
          const darkness = Math.round(10 + Math.pow(ratio, 1.8) * 90);

          return `
            <text x="${x}" y="${y}" font-size="10" font-weight="bold" fill="#${text_color}">
              ${label}:
            </text>
            <rect x="${pillX}" y="${y - 10}" width="${uniformPillWidth}" height="14" fill="#${darkenColor(chart_color, darkness)}" fill-opacity="0.2" />
            <text x="${pillX + uniformPillWidth / 2}" y="${y + 1}" font-size="9" text-anchor="middle" fill="#${text_color}">
              ${pillText}
            </text>
          `;
        });

        const legendHeight = Math.ceil(topProjects.length / legendCols) * legendLineHeight + legendYOffset;
        height = chartBase + radar_padding + legendHeight + 20; // trim to exact layout

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
          children: topProjects.map((proj, i) => ({
            value: proj.total_seconds,
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
          const projIndex = node.data.index;
          const proj = topProjects[projIndex];
          const seconds = proj.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const shortTime = formatShortTime(seconds);
          const label = proj.name;
          const color = varyColor(chart_color);

          elements.push(`<circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="#${color}" fill-opacity="0.85" />`);

          if (!hide_legend) {
            const x = centerOffsetX + (i % legendCols) * legendColWidth;
            const y = maxY + 30 + Math.floor(i / legendCols) * legendLineHeight;

            legendItems.push(`
              <circle cx="${x + legendCircleOffset}" cy="${y}" r="6" fill="#${color}" />
              <text x="${x + legendTextOffset}" y="${y + 3}" font-size="10" font-weight="bold" fill="#${text_color}">
                ${label}:
              </text>
              <text x="${x + legendTextOffset + 50}" y="${y + 3}" font-size="10" fill="#${text_color}">
                ${shortTime} (${pct}%)
              </text>
            `);
          }
        });

        const bubbleGroup = `<g transform="translate(${xOffset}, 0)">\n${elements.join('\n')}\n</g>`;

        if (!hide_legend) {
          const legendHeight = Math.ceil(topProjects.length / legendCols) * legendLineHeight + legendYOffset;
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

        topProjects.forEach((proj, i) => {
          const seconds = proj.total_seconds;
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

          const label = proj.name;
          const shortTime = formatShortTime(seconds);
          const pctText = (pct * 100).toFixed(1) + '%';

          // Project label (outer)
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
          elements.push(`
            <text font-size="9" fill="#${text_color}">
              <textPath href="#${dayPathId}" startOffset="50%" text-anchor="middle">${label}</textPath>
            </text>
          `);

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
    }
  })();

  const totalTimeText = params.custom_total
    ? `${Math.floor(params.custom_total / 3600)} hrs ${Math.floor((params.custom_total % 3600) / 60)} mins`
    : json.data.human_readable_total;

  const isFriendly = heading_type === 'friendly';
  const headingFontSize = isFriendly ? 12 : 14;

  const xCenter = chart_type === 'radar'
    ? chartWidth / 2 + 20
    : leftPadding / 2 + chartWidth / 2 + 20;

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