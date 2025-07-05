import { hierarchy, pack } from 'd3-hierarchy';

function formatShortTime(seconds) {
  if (seconds === 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}m`;
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

function varyColor(baseHex, variance = 30) {
  const [r, g, b] = hexToRgb(baseHex);
  const rand = () => Math.floor((Math.random() - 0.5) * variance);
  return rgbToHex(
    Math.min(255, Math.max(0, r + rand())),
    Math.min(255, Math.max(0, g + rand())),
    Math.min(255, Math.max(0, b + rand()))
  );
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

function truncateLabel(name, maxLength) {
  return name.length > maxLength ? name.slice(0, maxLength - 1) + '…' : name;
}

export async function getAlltimeLanguagesCard(params) {
  const {
    username,
    text_color,
    chart_color,
    chart_type,
    bg_color,
    chart_curved_line,
    heading_type,
    mixed_colors,
    num_langs,
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
  if (!json.data || !json.data.languages) {
    throw new Error('No all-time language data available.');
  }

  // Limit to top N languages
  const numLangs = parseInt(params.num_langs, 10) || 5;
  const topLanguages = json.data.languages
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, numLangs);

  // Extract total and max seconds for normalization
  const totalSeconds = topLanguages.reduce((sum, lang) => sum + lang.total_seconds, 0);
  const maxSeconds = Math.max(...topLanguages.map(lang => lang.total_seconds));

  // --- Friendly heading
  let headingText;
  if (params.custom_heading) {
    headingText = params.custom_heading;
  } else if (heading_type === 'friendly') {
  const topLang = topLanguages[0]?.name || 'Unknown';
    headingText = `I mostly code in ${topLang}`;
  } else {
    headingText = 'My Top Languages';
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
  const chartWidth = topLanguages.length * (barWidth + spacing);

  function getMixedColor(index) {
    return mixed_colors && index > 0
      ? darkenColor(chart_color, 20 + index * 10) // tweak the darkness variation
      : chart_color;
  }

  const chartSvgBlocks = (() => {
    switch (chart_type) {
      case 'bar': {
        const barBlocks = topLanguages.map((lang, i) => {
            const seconds = lang.total_seconds;
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
            `<text x="${x + barWidth / 2}" y="${chartBase + 12}" font-weight="bold" font-size="10" text-anchor="middle" fill="#${text_color}">${truncateLabel(lang.name, 10)}</text>`
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
        const barMaxWidth = chartWidth - leftPadding - 110;
        const barBlocks = topLanguages.map((lang, i) => {
          const seconds = lang.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const barWidth = maxSeconds ? (seconds / maxSeconds) * barMaxWidth : 0;
          const y = chartTop + i * rowHeight;
          const fill = getMixedColor(i);
          const shortTime = formatShortTime(seconds);

          const blocks = [];

          blocks.push(`<text x="${75 + leftPadding - 8}" y="${y + 9}" font-size="10" text-anchor="end" fill="#${text_color}">${truncateLabel(lang.name, 10)}</text>`);
          blocks.push(`<rect x="${75 + leftPadding}" y="${y}" width="${barWidth}" height="12" fill="#${fill}" rx="2" ry="2" />`);

          if (!hide_time && hide_percentage) {
            blocks.push(`<text x="${75 + leftPadding + barWidth + 6}" y="${y + 9}" font-size="9" fill="#${text_color}">${shortTime}</text>`);
          }

          if (!hide_time && !hide_percentage) {
            blocks.push(`<text x="${75 + leftPadding + barWidth + 6}" y="${y + 9}" font-size="9" fill="#${text_color}">${shortTime}    |    ${pct}%</text>`);
          }

          if (!hide_percentage && hide_time) {
            blocks.push(`<text x="${75 + leftPadding + barWidth + 6}" y="${y + 9}" font-size="9" fill="#${text_color}">${pct}%</text>`);
          }

          return blocks.join('\n');
        });

        height = topLanguages.length * rowHeight + chartTop + 30;

        return [...barBlocks];
      }
      case 'radar': {
        const cx = (chartWidth + 48) / 2;
        const cy = chartTop + chartHeight / 2 + radar_padding / 1.4;
        const radius = Math.min(chartHeight, chartWidth) / 0.7;
        const angleStep = (2 * Math.PI) / topLanguages.length;

        const points = topLanguages.map((lang, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const seconds = lang.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const r = maxSeconds ? (seconds / maxSeconds) * radius : 0;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return { x, y, angle, seconds, label: truncateLabel(lang.name, 10), pct };
        });

        const grid = [];
        const levels = 4;
        for (let l = 1; l <= levels; l++) {
          const r = (l / levels) * radius;
          const path = [];
          for (let i = 0; i < topLanguages.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            path.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
          }
          grid.push(`<path d="${path.join(' ')} Z" fill="none" stroke="#${darkenColor(bg_color, 120)}" stroke-dasharray="2,2" stroke-width="0.5"/>`);
        }

        const axisLines = topLanguages.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#${darkenColor(bg_color, 120)}" stroke-width="0.5"/>`;
        });

        const labels = topLanguages.map((lang, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelDist = radius + 20;
          const x = cx + labelDist * Math.cos(angle);
          const y = cy + labelDist * Math.sin(angle);
          return `<text x="${x}" y="${y}" font-size="10" text-anchor="middle" alignment-baseline="middle" fill="#${text_color}">${truncateLabel(lang.name, 6)}</text>`;
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
        const legendYOffset = 80;
        const legendLineHeight = 24;
        const legendCols = 2;
        const legendColWidth = 190;
        const centerOffsetX = ((chartWidth + 95) - legendCols * legendColWidth) / 2;

        // --- Calculate max width for legend pill
        const allPillTexts = topLanguages.map(lang => {
          const time = formatShortTime(lang.total_seconds);
          const pct = ((lang.total_seconds / totalSeconds) * 100).toFixed(1) + '%';
          return `${time} (${pct})`;
        });
        const maxPillText = allPillTexts.reduce((a, b) => (a.length > b.length ? a : b));
        const uniformPillWidth = maxPillText.length * 5 + 8; // consistent size for all

        const legendItems = topLanguages.map((lang, i) => {
          const shortTime = formatShortTime(lang.total_seconds);
          const pct = ((lang.total_seconds / totalSeconds) * 100).toFixed(1) + '%';
          const label = truncateLabel(lang.name, 10);
          const x = centerOffsetX + (i % legendCols) * legendColWidth;
          const y = chartBase + radar_padding + legendYOffset + Math.floor(i / legendCols) * legendLineHeight;

          const pillText = `${shortTime} (${pct})`;
          const pillX = x + 70;

          const ratio = lang.total_seconds / maxSeconds;
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

        const legendHeight = Math.ceil(topLanguages.length / legendCols) * legendLineHeight + legendYOffset;
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
          children: topLanguages.map((lang, i) => ({
            value: lang.total_seconds,
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
        const legendColWidth = 180;
        const legendCircleOffset = 12;
        const legendTextOffset = 24;
        const legendYOffset = 40;
        const legendLineHeight = 20;
        const centerOffsetX = ((chartWidth + 65) - legendCols * legendColWidth) / 2;

        leaves.forEach((node, i) => {
          const langIndex = node.data.index;
          const lang = topLanguages[langIndex];
          const seconds = lang.total_seconds;
          const pct = ((seconds / totalSeconds) * 100).toFixed(1);
          const shortTime = formatShortTime(seconds);
          const label = truncateLabel(lang.name, 10);
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
              <text x="${x + legendTextOffset + 70}" y="${y + 3}" font-size="10" fill="#${text_color}">
                ${shortTime} (${pct}%)
              </text>
            `);
          }
        });

        const bubbleGroup = `<g transform="translate(${xOffset}, 0)">\n${elements.join('\n')}\n</g>`;

        if (!hide_legend) {
          const legendHeight = Math.ceil(topLanguages.length / legendCols) * legendLineHeight + legendYOffset;
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
        const innerLabelRadius1 = (outerRadius + innerRadius) / 2 - 8;
        const innerLabelRadius2 = (outerRadius + innerRadius) / 2 + 4;
        const minLabelAngle = Math.PI / 10;
        const labelPadding = 0.08; // in radians (~5°)
        let startAngle = 0;

        const elements = [];
        const defs = [];

        topLanguages.forEach((lang, i) => {
            const seconds = lang.total_seconds;
            if (seconds === 0) return;

            const pct = seconds / totalSeconds;
            const pctValue = (pct * 100).toFixed(1);
            const hideOuterLabel = pctValue < 5;

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

            const label = truncateLabel(lang.name, 10);
            const shortTime = formatShortTime(seconds);
            const pctText = pctValue + '%';
        
            // Language label (outer), shorten arc
            if (!hideOuterLabel) {
                const labelStart = startAngle + labelPadding;
                const labelEnd = endAngle - labelPadding;
                const dx1 = centerX + outerLabelRadius * Math.cos(labelStart);
                const dy1 = centerY + outerLabelRadius * Math.sin(labelStart);
                const dx2 = centerX + outerLabelRadius * Math.cos(labelEnd);
                const dy2 = centerY + outerLabelRadius * Math.sin(labelEnd);
                const dayPathId = `dayPath${i}`;
                defs.push(`
                <path id="${dayPathId}" fill="none" d="
                    M ${dx1} ${dy1}
                    A ${outerLabelRadius} ${outerLabelRadius} 0 ${largeArcFlag} 1 ${dx2} ${dy2}
                " />
                `);
                const labelCharWidth = 5.5; // rough px per character for font-size 9
                const estimatedLabelWidth = label.length * labelCharWidth;
                const arcLengthEstimate = outerLabelRadius * (labelEnd - labelStart);

                const anchor = estimatedLabelWidth > arcLengthEstimate ? 'start' : 'middle';
                const startOffset = anchor === 'start' ? '2%' : '50%';

                elements.push(`
                <text font-size="9" fill="#${text_color}">
                    <textPath href="#${dayPathId}" startOffset="${startOffset}" text-anchor="${anchor}">${label}</textPath>
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