import { createCanvas } from 'canvas';

// Convert hex to HSL
function hexToHSL(hex) {
  hex = String(hex).replace(/^#/, '');
  const bigint = parseInt(hex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert HSL to hex
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Apply hue shift
function generateColorWheel(baseHex, count, bgHex = '#ffffff') {
  const baseHSL = hexToHSL(baseHex);
  const bgHSL = hexToHSL(bgHex);

  const isBgDark = bgHSL.l < 50;

  const delta = 20; // how much lightness will shift
  const startL = isBgDark
    ? Math.max(baseHSL.l - delta, 0)
    : baseHSL.l;
  const endL = isBgDark
    ? baseHSL.l
    : Math.max(baseHSL.l - delta, 0);

  const opacityStart = 0.1;
  const opacityEnd = 1.0;

  const result = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const l = Math.round(startL + (endL - startL) * t);
    const color = hslToHex(baseHSL.h, baseHSL.s, l);
    const opacity = (opacityStart + (opacityEnd - opacityStart) * t).toFixed(2);
    result.push({ color, opacity });
  }

  return result;
}

// Your existing utility functions remain unchanged
function secondsToHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return { h, m };
}
function formatHM({ h, m }) { return `${h} hrs ${m} mins`; }
function generateArrow(diff) { return diff >= 0 ? '↑' : '↓'; }
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
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function getArrowSVG(diff, color = '#000', size = 14) {
  const upArrow = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"></line>
      <polyline points="5 12 12 5 19 12"></polyline>
    </svg>`;

  const downArrow = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <polyline points="19 12 12 19 5 12"></polyline>
    </svg>`;

  return diff >= 0 ? upArrow : downArrow;
}

function hexToRgba(hex, opacity) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

function darkenHexColor(hex, factor = 0.95) {
  const { h, s, l } = hexToHSL(hex);
  const darkenedL = l * factor;
  return hslToHex(h, s, darkenedL);
}

export async function getSpedometerCard({
  api_key,
  username,
  text_color,
  font_family,
  difficulty,
  label_type,
  chart_color,
  custom_emojis,
  show_high_score
}) {
  chart_color = chart_color.replace(/^#/, '');
  text_color = text_color.replace(/^#/, '');
  const apiKey = api_key ?? '';
  if (!apiKey || apiKey === '') throw new Error('Missing WAKATIME_API_KEY');

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

  let referenceSeconds = avgSeconds;
  let bestDaySeconds = yearlyStats?.data?.best_day?.total_seconds || 0;
    try {
    if (difficulty === 'self') {
        bestDaySeconds = yearlyStats?.data?.best_day?.total_seconds || avgSeconds;
        referenceSeconds = bestDaySeconds * 0.8;
    } else {
        let targetRank;
        if (difficulty === 'easy') targetRank = 10000;
        else if (difficulty === 'medium') targetRank = 1000;
        else if (difficulty === 'hard') targetRank = 1;

        const page = Math.ceil(targetRank / 100);
        const leadersRes = await fetch(`https://wakatime.com/api/v1/leaders?page=${page}`, { headers });
        const leadersData = await leadersRes.json();
        const targetEntry = leadersData?.data?.find(d => Number(d.rank) === targetRank);
        referenceSeconds = targetEntry?.running_total?.daily_average ?? avgSeconds;
    }
    } catch (err) {
    console.warn(`[Spedometer] Failed to fetch reference data → fallback to avgSeconds.`, err.message);
    }

  const scaleMaxSeconds = referenceSeconds / 0.8;
  const percent = Math.min((todaySeconds / scaleMaxSeconds) * 100, 200);
  const percentChange = Math.round(((todaySeconds - avgSeconds) / avgSeconds) * 100);
  const todayHM = secondsToHMS(todaySeconds);
  const avgHM = secondsToHMS(avgSeconds);

  const width = 300;
  const height = 260;
  const cx = width / 2;
  const cy = 160;
  const r = 80;

  function parseCustomEmojis(input) {
    const allEmojis = Array.from(input).filter(char => /\p{Emoji}/u.test(char));
    return Array(5).fill('').map((_, i) => allEmojis[i] || '');
  }
  const customEmojiArray = parseCustomEmojis(custom_emojis);

  const labelSets = {
    game: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
    standard: ['Poor', 'Fair', 'Good', 'Great', 'Excellent'],
    emoji: ['🌱', '🌿', '🌾', '🌳', '🌲'],

    // Combo sets
    emojiStandard: ['🌱 Poor', '🌿 Fair', '🌾 Good', '🌳 Great', '🌲 Excellent'],

    emojiGame: ['🌱 Bronze', '🌿 Silver', '🌾 Gold', '🌳 Platinum', '🌲 Diamond'],

    customEmoji: customEmojiArray,
    customStandard: ['Poor', 'Fair', 'Good', 'Great', 'Excellent'],
    customGame: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
    customEmojiStandard: customEmojiArray.map((e, i) => `${e} ${['Poor', 'Fair', 'Good', 'Great', 'Excellent'][i]}`),
    customEmojiGame: customEmojiArray.map((e, i) => `${e} ${['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'][i]}`)
  };

  const chosenLabels = labelSets[label_type] || labelSets.standard;
  const chartColors = generateColorWheel(chart_color, 5);

  const segments = chosenLabels.map((label, i) => ({
    start: i * 36,
    end: (i + 1) * 36,
    color: chartColors[i].color,
    opacity: chartColors[i].opacity,
    label
  }));

  const arcGroup = `
    <g transform="rotate(-90, ${cx}, ${cy})">
      ${segments.map((s, i) => `
        <path
          d="${describeArc(cx, cy, r, s.start, s.end)}"
          stroke="${hexToRgba(s.color, s.opacity)}"
          stroke-width="45"
          fill="none"
        />
        <path id="arcLabel-${i}" d="${describeArc(cx, cy, r + 30, s.start, s.end)}" fill="none" />
        <text font-size="10" fill="#${text_color}" font-family="${font_family}">
          <textPath href="#arcLabel-${i}" startOffset="50%" text-anchor="middle">${s.label}</textPath>
        </text>
      `).join('\n')}
    </g>
  `;

  const angleDeg = (Math.min(percent, 100) / 100) * 180;
  const displayAngle = angleDeg - 90;
  const tip = polarToCartesian(cx, cy, r - 4, displayAngle);
  const left = polarToCartesian(cx, cy, 4, displayAngle + 90);
  const right = polarToCartesian(cx, cy, 4, displayAngle - 90);
  const needleColor = darkenHexColor(chart_color, 0.75);

  const needle = `
    <polygon points="${left.x},${left.y} ${tip.x},${tip.y} ${right.x},${right.y}" fill="${needleColor}" />
    <circle cx="${cx}" cy="${cy}" r="4" fill="${needleColor}"/>
  `;
    
    // High score marker
    let highScoreMarker = '';
    if (show_high_score && bestDaySeconds > 0) {
    const scaleMaxSeconds = referenceSeconds / 0.8;
    const highScorePercent = (bestDaySeconds / scaleMaxSeconds) * 100;

    if (highScorePercent <= 100) {
        const highScoreAngle = (highScorePercent / 100) * 180 - 90;

        // Lighten the color for visibility
        const baseSegmentIndex = Math.floor(highScorePercent / 20);
        const baseColor = chartColors[baseSegmentIndex]?.color || '#888'; // aesthetic brown fallback
        const baseHSL = hexToHSL(baseColor);
        const adjustedL = Math.min(baseHSL.l + 15, 95); // don't go to 100
        const lighterHex = hslToHex(baseHSL.h, baseHSL.s, adjustedL);

        const inner = polarToCartesian(cx, cy, r - 22.5, highScoreAngle);
        const outer = polarToCartesian(cx, cy, r + 22.5, highScoreAngle);

        // NEW: position inside the arc
        const labelRadius = r - 35;
        const labelPos = polarToCartesian(cx, cy, labelRadius, highScoreAngle);

        highScoreMarker = `
        <line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}"
                stroke="${lighterHex}" stroke-width="2" />
        <text x="${labelPos.x}" y="${labelPos.y}" font-size="12" font-weight="bold" fill="${lighterHex}"
                font-family="${font_family}" text-anchor="middle">
            ⚑
        </text>
        `;
    }
    }

  return {
    content: `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="22" text-anchor="middle" font-size="14" fill="#${text_color}" font-family="${font_family}">
          <tspan font-weight="bold">${formatHM(todayHM)}</tspan>
          <tspan font-weight="normal"> Today</tspan>
        </text>
        ${arcGroup}
        ${needle}
        ${highScoreMarker}
        <g transform="translate(${width / 2 - 40}, ${cy + 42})">
          ${getArrowSVG(percentChange, `#${text_color}`, 14)}
          <text x="20" y="12" font-size="13" fill="#${text_color}" font-family="${font_family}">
              ${Math.abs(percentChange)}% ${percentChange >= 0 ? 'increase' : 'decrease'}
          </text>
        </g>
        <text x="50%" y="${cy + 70}" text-anchor="middle" font-size="13" fill="#${text_color}" font-family="${font_family}">
          <tspan font-weight="bold">${formatHM(avgHM)}</tspan>
          <tspan font-weight="normal"> Daily Average</tspan>
        </text>
        <text x="50%" y="${cy + 90}" text-anchor="middle" font-size="13" fill="#${text_color}" font-family="${font_family}">
          <tspan font-weight="bold">${mostActiveDay}</tspan>
          <tspan font-weight="normal"> Most Active Day</tspan>
        </text>
      </svg>
    `,
    width,
    height
  };
}
