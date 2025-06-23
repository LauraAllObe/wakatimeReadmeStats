import { createCanvas } from 'canvas';
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

function colorDistance(c1, c2) {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return Math.sqrt((r1 - r2)**2 + (g1 - g2)**2 + (b1 - b2)**2);
}

function catmullRom2bezier(points, minY = 0, maxY = Infinity) {
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

    // Clamp to stay within chart bounds
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

export async function getProjectBreakdownCard(params) {
  const {
    username,
    text_color = '999999',
    chart_color = '00aaff',
    chart_type = 'bar',
    bg_color = 'ffffff',
    chart_curved_line = false,
    start_day = '-7',
    heading_type = 'friendly',
    mixed_colors = false,
    hide_legend = false,
    hide_total = false,
    hide_time = false,
    hide_percentage = true,
    hide_title = false,
  } = params;
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
  let days = params.custom_days || json.data;
  if (!days || days.length === 0) {
    throw new Error('No 7-day summary data available.');
  }

  if (start_day && start_day !== '-7') {
    days = reorderDays(days, start_day);
  }

  // Extract project times per day
    const projectDataByDay = days.map(d => {
    const date = d.range.date;
    const projects = d.projects || [];
    const projectMap = {};
    for (const p of projects) {
        projectMap[p.name] = (projectMap[p.name] || 0) + p.total_seconds;
    }
    return {
        date,
        projects: projectMap
    };
    });

    // Get all unique project names across all days
    const allProjects = Array.from(
    new Set(projectDataByDay.flatMap(d => Object.keys(d.projects)))
    );

    // Build a 2D structure: project -> [seconds per day]
    const projectSeries = {};
    for (const name of allProjects) {
    projectSeries[name] = projectDataByDay.map(d => d.projects[name] || 0);
    }

    // Per-day totals for stacking & label percentages
    const dailyTotals = projectDataByDay.map(d =>
    Object.values(d.projects).reduce((a, b) => a + b, 0)
    );

    const totalSeconds = dailyTotals.reduce((a, b) => a + b, 0);
    const maxSeconds = Math.max(...dailyTotals);

  // --- Friendly heading
  let headingText;
  if (params.custom_heading) {
    headingText = params.custom_heading;
  } else if (heading_type === 'friendly') {
    const projectTotals = {};
    for (const day of days) {
        for (const p of day.projects || []) {
        projectTotals[p.name] = (projectTotals[p.name] || 0) + p.total_seconds;
        }
    }
    const topProject = Object.entries(projectTotals)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'various things';
    headingText = `This week, I mostly worked on ${topProject}`;
  } else {
    headingText = 'This Week\'s Coding Time';
  }

  const top_padding = 22.5;
  const barWidth = 30;
  const spacing = 15;
  const titleHeight = hide_title ? 0 : 14;
  const chartTop = top_padding + titleHeight + 10;
  const chartHeight = 60;
  const chartBottom = 60;
  const chartBase = chartTop + chartHeight;
  const radar_padding = 110;
  let height = chartBase + chartBottom;
  if (chart_type === 'radar') {
    height += radar_padding;
  }
  const chartWidth = days.length * (barWidth + spacing);
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function getMixedColor(index) {
    return mixed_colors && index > 0
      ? darkenColor(chart_color, 20 + index * 10) // tweak the darkness variation
      : chart_color;
  }

  const projectColors = {};
    allProjects.forEach(name => {
    let newColor;
    let attempts = 0;
    const existing = Object.values(projectColors);
    do {
        newColor = mixed_colors ? varyColor(chart_color, 200) : chart_color;
        attempts++;
    } while (
        mixed_colors &&
        existing.some(c => colorDistance(c, newColor) < 60) &&
        attempts < 10
    );
    projectColors[name] = newColor;
    });

  const chartSvgBlocks = (() => {
    switch (chart_type) {
      case 'bar': {
        const allBlocks = [];

        days.forEach((d, i) => {
            const x = i * (barWidth + spacing) + 30;
            let y = chartBase;
            const dayBlocks = [];

            for (const project of allProjects) {
            const seconds = projectSeries[project][i];
            if (!seconds) continue;

            const heightRatio = seconds / maxSeconds;
            const segmentHeight = heightRatio * chartHeight;
            y -= segmentHeight;

            dayBlocks.push(`
                <rect x="${x}" y="${y}" width="${barWidth}" height="${segmentHeight}" fill="#${projectColors[project]}" rx="2" ry="2">
                <title>${project}: ${formatShortTime(seconds)}</title>
                </rect>
            `);
            }

            const dayName = getSafeDayName(d.range.date);
            dayBlocks.push(`<text x="${x + barWidth / 2}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}">${dayName}</text>`);

            allBlocks.push(...dayBlocks);
        });

        // Legend generation (run ONCE)
        const legendYOffset = 36; // <- padding before legend
        const legendLineHeight = 20;
        const legendCols = 2;
        const maxLabelLength = Math.max(...allProjects.map(p => p.length));
        const avgCharWidth = 6.5; // SVG font size ~10px = ~6.5px per character
        const labelWidth = maxLabelLength * avgCharWidth;
        const legendColWidth = 12 + 10 + labelWidth + 10; // circle + spacing + label + padding
        const svgWidth = Math.max(chartWidth, 300) + 105;
        const totalLegendWidth = legendCols * legendColWidth;
        const centerOffsetX = (svgWidth - totalLegendWidth) / 2;

        const legendItems = !hide_legend ? allProjects.map((project, i) => {
            const x = centerOffsetX + (i % legendCols) * legendColWidth;
            const y = chartBase + legendYOffset + Math.floor(i / legendCols) * legendLineHeight;
            const groupX = centerOffsetX + (i % legendCols) * legendColWidth;

            return `
            <circle cx="${groupX}" cy="${y - 4}" r="5" fill="#${projectColors[project]}" />
            <text x="${groupX + 12}" y="${y}" font-size="10" fill="#${text_color}">${project}</text>
            `;
        }) : [];

        const legendHeight = hide_legend ? 0 : Math.ceil(allProjects.length / legendCols) * legendLineHeight + legendYOffset;
        height = Math.max(height, chartBase + legendYOffset + legendHeight - 20);

        return [...allBlocks, ...legendItems];
        }
      case 'line': {
        const curved = typeof chart_curved_line === 'string'
            ? chart_curved_line === 'true'
            : !!chart_curved_line;

        const elements = [];
        const labelElements = [];

        for (const project of allProjects) {
            const points = projectSeries[project].map((seconds, i) => {
            const x = i * (barWidth + spacing) + 30 + barWidth / 2;
            const yVal = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
            const y = chartBase - yVal;
            return { x, y, seconds, dayIndex: i };
            });

            if (points.every(p => p.seconds === 0)) continue; // skip empty

            const pathD = curved && points.length > 1
            ? catmullRom2bezier(points, chartBase - chartHeight, chartBase)
            : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            const color = projectColors[project];

            // Path line
            elements.push(`<path d="${pathD}" fill="none" stroke="#${color}" stroke-width="2" />`);
            
            // Dots
            elements.push(...points.map(p =>
            `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#${color}">
                <title>${project}: ${formatShortTime(p.seconds)}</title>
            </circle>`
            ));

            // Optional value/time labels
            if (!hide_time || !hide_percentage) {
            labelElements.push(...points.map((p, i) => {
                const shortTime = formatShortTime(p.seconds);
                const pct = ((p.seconds / totalSeconds) * 100).toFixed(1);
                const timeLabel = !hide_time
                ? `<text x="${p.x}" y="${p.y - 6}" font-size="8.5" text-anchor="middle" fill="#${text_color}" fill-opacity="0.9">${shortTime}</text>`
                : '';
                const pctLabel = !hide_percentage
                ? `<text x="${p.x}" y="${p.y - 16}" font-size="8" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${pct}%</text>`
                : '';
                return `${timeLabel}${pctLabel}`;
            }));
            }
        }

        // X-axis day labels (one per day)
        const dayLabels = days.map((d, i) => {
            const x = i * (barWidth + spacing) + 30 + barWidth / 2;
            const dayName = getSafeDayName(d.range.date);
            return `<text x="${x}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${dayName}</text>`;
        });

        const outputBlocks = [...elements, ...labelElements, ...dayLabels];

        if (!hide_legend) {
            const legendYOffset = 36;
            const legendLineHeight = 20;
            const legendCols = 2;
            const maxLabelLength = Math.max(...allProjects.map(p => p.length));
            const avgCharWidth = 6.5; // SVG font size ~10px = ~6.5px per character
            const labelWidth = maxLabelLength * avgCharWidth;
            const legendColWidth = 12 + 10 + labelWidth + 10; // circle + spacing + label + padding
            const svgWidth = Math.max(chartWidth, 300) + 105;
            const totalLegendWidth = legendCols * legendColWidth;
            const centerOffsetX = (svgWidth - totalLegendWidth) / 2;

            const legendItems = allProjects.map((project, i) => {
                const x = centerOffsetX + (i % legendCols) * legendColWidth;
                const y = chartBase + legendYOffset + Math.floor(i / legendCols) * legendLineHeight;
                const groupX = centerOffsetX + (i % legendCols) * legendColWidth;

                return `
                <circle cx="${groupX}" cy="${y - 4}" r="5" fill="#${projectColors[project]}" />
                <text x="${groupX + 12}" y="${y}" font-size="10" fill="#${text_color}">${project}</text>
                `;
            });

            const legendHeight = Math.ceil(allProjects.length / legendCols) * legendLineHeight + legendYOffset;
            height = Math.max(height, chartBase + legendYOffset + legendHeight - 20);

            return [...outputBlocks, ...legendItems]; // replace `outputBlocks` with your chart block array
            }
        }
    case 'area': {
        const curved = typeof chart_curved_line === 'string'
            ? chart_curved_line === 'true'
            : !!chart_curved_line;

        const xPositions = days.map((_, i) => i * (barWidth + spacing) + 30 + barWidth / 2);
        const areaElements = [];
        const labelElements = [];

        for (const project of allProjects) {
            const color = projectColors[project];
            const points = [];

            for (let i = 0; i < days.length; i++) {
            const seconds = projectSeries[project][i];
            let height = maxSeconds ? (seconds / maxSeconds) * chartHeight : 0;
            if (seconds > 0 && height < 1.5) height = 1.5;

            const x = xPositions[i];
            const y = chartBase - height;
            points.push({ x, y, seconds });
            }

            const topLine = curved && points.length > 1
            ? catmullRom2bezier(points, chartBase - chartHeight, chartBase)
            : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            const bottomPoints = points.map(p => ({
            x: p.x,
            y: chartBase
            })).reverse();

            const areaPath = `
            ${topLine}
            ${bottomPoints.map(p => `L ${p.x} ${p.y}`).join(' ')}
            Z
            `;

            areaElements.push(`
            <path d="${areaPath.trim()}" fill="#${color}" fill-opacity="0.25" />
            <path d="${topLine.trim()}" fill="none" stroke="#${color}" stroke-width="1.5" />
            `);

            // Optional: circles and labels
            if (!hide_time || !hide_percentage) {
            labelElements.push(...points.map((p, i) => {
                const shortTime = formatShortTime(p.seconds);
                const pct = ((p.seconds / totalSeconds) * 100).toFixed(1);
                const timeLabel = !hide_time
                ? `<text x="${p.x}" y="${p.y - 6}" font-size="8.5" text-anchor="middle" fill="#${text_color}" fill-opacity="0.85">${shortTime}</text>`
                : '';
                const pctLabel = !hide_percentage
                ? `<text x="${p.x}" y="${p.y - 15}" font-size="8" text-anchor="middle" fill="#${text_color}" fill-opacity="0.6">${pct}%</text>`
                : '';
                return `
                <circle cx="${p.x}" cy="${p.y}" r="2.2" fill="#${color}">
                    <title>${project}: ${shortTime}</title>
                </circle>
                ${timeLabel}${pctLabel}
                `;
            }));
            }
        }

        const dayLabels = days.map((d, i) => {
            const x = xPositions[i];
            const dayName = getSafeDayName(d.range.date);
            return `<text x="${x}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}" fill-opacity="0.7">${dayName}</text>`;
        });

        const outputBlocks = [...areaElements, ...labelElements, ...dayLabels];

        if (!hide_legend) {
            const legendYOffset = 36;
            const legendLineHeight = 20;
            const legendCols = 2;
            const maxLabelLength = Math.max(...allProjects.map(p => p.length));
            const avgCharWidth = 6.5;
            const labelWidth = maxLabelLength * avgCharWidth;
            const legendColWidth = 12 + 10 + labelWidth + 10;
            const svgWidth = Math.max(chartWidth, 300) + 105;
            const totalLegendWidth = legendCols * legendColWidth;
            const centerOffsetX = (svgWidth - totalLegendWidth) / 2;

            const legendItems = allProjects.map((project, i) => {
            const x = centerOffsetX + (i % legendCols) * legendColWidth;
            const y = chartBase + legendYOffset + Math.floor(i / legendCols) * legendLineHeight;
            return `
                <circle cx="${x}" cy="${y - 4}" r="5" fill="#${projectColors[project]}" />
                <text x="${x + 12}" y="${y}" font-size="10" fill="#${text_color}">${project}</text>
            `;
            });

            const legendHeight = Math.ceil(allProjects.length / legendCols) * legendLineHeight + legendYOffset;
            height = Math.max(height, chartBase + legendYOffset + legendHeight - 20);

            return [...outputBlocks, ...legendItems];
        }

        return outputBlocks;
        }
      case 'radar': {
        const svgWidth = Math.max(chartWidth, 300) + 48;
        const cx = svgWidth / 2;
        const cy = chartTop + chartHeight / 2 + radar_padding / 1.7;
        const radius = Math.min(chartHeight, chartWidth) / 0.7;
        const angleStep = (2 * Math.PI) / days.length;

        // Draw radar grid
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
            grid.push(`<path d="${path.join(' ')} Z" fill="none" stroke="#${darkenColor(bg_color, 120)}" stroke-dasharray="2,2" stroke-width="0.5"/>`);
        }

        // Draw axis lines
        const axisLines = days.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#${darkenColor(bg_color, 120)}" stroke-width="0.5"/>`;
        });

        // Draw each project polygon
        const projectPolygons = allProjects.map(project => {
            const points = projectSeries[project].map((seconds, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const r = maxSeconds ? (seconds / maxSeconds) * radius : 0;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            return { x, y, seconds };
            });

            const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');
            const color = projectColors[project];

            return `
            <polygon points="${polygonPoints}" fill="#${color}" fill-opacity="0.2" stroke="#${color}" stroke-width="2" />
            ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="2.2" fill="#${color}"><title>${project}: ${formatShortTime(p.seconds)}</title></circle>`).join('\n')}
            `;
        });

        // Label each day around the radar
        const labels = days.map((d, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const labelDist = radius + 12;
            const x = cx + labelDist * Math.cos(angle);
            const y = cy + labelDist * Math.sin(angle);
            const dayName = getSafeDayName(d.range.date);
            return `<text x="${x}" y="${y}" font-size="10" text-anchor="middle" alignment-baseline="middle" fill="#${text_color}">${dayName}</text>`;
        });

        // Optional project legend
        const legendYOffset = 47.5;
        const legendLineHeight = 20;
        const legendCols = 2;
        const maxLabelLength = Math.max(...allProjects.map(p => p.length));
        const avgCharWidth = 6.5; // SVG font size ~10px = ~6.5px per character
        const labelWidth = maxLabelLength * avgCharWidth;
        const legendColWidth = 12 + 10 + labelWidth + 10; // circle + spacing + label + padding
        const totalLegendWidth = legendCols * legendColWidth;
        const svgWidth2 = Math.max(chartWidth, 300) + 105;
        const centerOffsetX = (svgWidth2 - totalLegendWidth) / 2;

        const legendItems = allProjects.map((project, i) => {
            const x = centerOffsetX + (i % legendCols) * legendColWidth;
            const y = chartBase + radar_padding + legendYOffset + Math.floor(i / legendCols) * legendLineHeight;
            const groupX = centerOffsetX + (i % legendCols) * legendColWidth;

            return `
            <circle cx="${groupX}" cy="${y - 4}" r="5" fill="#${projectColors[project]}" />
            <text x="${groupX + 12}" y="${y}" font-size="10" fill="#${text_color}">${project}</text>
            `;
        });

        const legendHeight = Math.ceil(allProjects.length / legendCols) * legendLineHeight + legendYOffset;
        height = chartBase + radar_padding + legendHeight + 15;

        return [
            ...grid,
            ...axisLines,
            ...projectPolygons,
            ...labels,
            ...legendItems
        ];
        }
    }
  })();

  const totalTimeText = params.custom_total
  ? `${Math.floor(params.custom_total / 3600)} hrs ${Math.floor((params.custom_total % 3600) / 60)} mins`
  : json.cumulative_total.text;

  const isFriendly = heading_type === 'friendly';
  const headingFontSize = isFriendly ? 12 : 14;

  const title = !hide_title
    ? `<text x="${chartWidth / 2 + 20}" y="${top_padding}" font-size="${headingFontSize}" text-anchor="middle" fill="#${text_color}" font-weight="bold">${headingText}</text>`
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
    width: Math.max(chartWidth, 300) + 48
  };
}