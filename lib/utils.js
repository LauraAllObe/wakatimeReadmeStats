export function parseHours(humanTime) {
  const [hrsStr, minsStr] = humanTime.split('hrs');
  const hours = parseFloat(hrsStr?.trim()) || 0;
  const minutes = parseFloat(minsStr?.replace('mins', '').trim()) || 0;
  return hours + minutes / 60;
}

function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(text, maxCharsPerLine = 70) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

export function renderErrorSvg({
  title = 'WakaTime Error',
  message = 'Unknown error occurred.',
  width = 480,
  height = 120,
  fontFamily = 'Calibri',
  textColor = '#333333',
  titleColor = '#333333',
  bgColor = '#ffffff',
  titleFontSize = 14,
  messageFontSize = 12,
  titleX = 20,
  titleY = 24,
  messageX = 20,
  messageY = 48,
  maxCharsPerLine = 70,
  lineHeight = 15
} = {}) {
  const safeTitle = escapeSvgText(title);
  const safeMessage = escapeSvgText(message);
  const lines = wrapText(safeMessage, maxCharsPerLine);
  const lineCount = Math.max(lines.length, 1);
  const computedHeight = Math.max(height, 60 + (lineCount * lineHeight));

  const messageLines = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${messageX}" dy="${dy}">${escapeSvgText(line)}</tspan>`;
    })
    .join('');

  return `
    <svg width="${width}" height="${computedHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family:${fontFamily},sans-serif;">
      <rect width="100%" height="100%" fill="#${bgColor.replace(/^#/, '')}" />
      <text x="${titleX}" y="${titleY}" fill="#${titleColor.replace(/^#/, '')}" font-size="${titleFontSize}" font-weight="bold">${safeTitle}</text>
      <text x="${messageX}" y="${messageY}" fill="#${textColor.replace(/^#/, '')}" font-size="${messageFontSize}" xml:space="preserve">
        ${messageLines}
      </text>
    </svg>`;
}

export function safeFetchJson(url, headers = {}, timeout = 10000) {
  return Promise.race([
    fetch(url, { headers }).then(res => res.json()),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeout))
  ]);
}
