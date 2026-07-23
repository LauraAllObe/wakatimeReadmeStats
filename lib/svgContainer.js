import fs from 'fs';
import path from 'path';

export function svgContainer({
  border_color = '333333',
  border_width = 1,
  border_radius = 4,
  bg_color = 'ffffff',
  font_family = 'Calibri',
  show_header = true,
  show_logo = true,
  logo_color = '000000',
  title_color = '333333',
  title_prefix = '',
  components = [],
  scale = false,
  title_scale_value,
  component_scale_values = {}
}) {
  const spacing = 20;
  const baseTitleHeight = 40;
  const svgTagRegex = /^\s*<svg[^>]*>\s*|\s*<\/svg>\s*$/gi;
  const headerVisible = show_header;
  const logoVisible = headerVisible && show_logo;

  // Logo block
  let logoSvg = '';
  if (logoVisible) {
    try {
      const rawLogo = fs.readFileSync(path.join(process.cwd(), 'static', 'wakatime.svg'), 'utf-8');
      const inner = rawLogo
        .replace(/<\?xml[^>]*>/g, '')
        .replace(/<!DOCTYPE[^>]*>/g, '')
        .replace(/<svg[^>]*>/, '')
        .replace('</svg>', '');
      logoSvg = `<g transform="translate(20,12.5) scale(0.075)" style="color:#${logo_color}">${inner}</g>`;
    } catch (e) {
      console.warn('⚠️ Logo file missing or invalid.', e);
    }
  }

  // 1. Determine component widths and fallback to 320 for unknown widths
  const componentWidths = components.map(c => {
    const width = Number.isFinite(c.width) && c.width > 0 ? c.width : 320;
    return width;
  });
  const baseSvgWidth = Math.max(...componentWidths, 350); // fallback to 350

  // 2. Title block (scaled relative to max width)
  const titleText = `${title_prefix || ''} Stats`.trim();

  const logoScale = 0.075;
  const groupX = 20;  // outer padding
  const groupY = 20;  // vertical positioning before scaling

  const logoWidth = 400; // native logo width
  const logoHeight = 400; // native logo height
  const scaledLogoHeight = logoHeight * logoScale;
  const textFontSize = 16;
  const textY = logoHeight * logoScale / 2;

  const logoInner = logoVisible
    ? logoSvg.replace(/^<g[^>]*>|<\/g>$/g, '') // remove existing wrapping <g>
    : '';

  const scaledComponents = components.map((c, idx) => {
    const originalWidth = Number.isFinite(c.width) && c.width > 0 ? c.width : 320;
    const hasCustomScale = typeof component_scale_values[idx] === 'number';
    const userScale = hasCustomScale ? component_scale_values[idx] : 1;

    let finalScale;
    if (hasCustomScale) {
      finalScale = userScale;
    } else if (scale && originalWidth > 0) {
      finalScale = baseSvgWidth / originalWidth;
    } else {
      finalScale = 1;
    }

    return {
      ...c,
      originalWidth,
      finalScale,
      scaledWidth: originalWidth * finalScale
    };
  });

  const svgEffectiveWidth = Math.max(...scaledComponents.map(c => c.scaledWidth), 350);
  const effectiveTitleScale = typeof title_scale_value === 'number'
    ? title_scale_value * (svgEffectiveWidth / 350)
    : 1;

  const scaledTitleBlock = headerVisible ? `
    <g transform="translate(${groupX}, ${groupY}) scale(${effectiveTitleScale})">
      ${logoVisible ? `<g transform="scale(${logoScale})" style="color:#${logo_color}">${logoInner}</g>` : ''}
      <text x="${logoWidth * logoScale}" y="${textY}" fill="#${title_color}" font-size="${textFontSize}" font-family="${font_family}">
        ${titleText}
      </text>
    </g>` : '';

  const titleHeight = headerVisible
    ? baseTitleHeight * (typeof title_scale_value === 'number' ? title_scale_value : 1)
    : 0;

  const titlePaddingBottom = 10;
  // 4. Compose and position components
  let currentY = titleHeight + (headerVisible ? spacing + titlePaddingBottom : titlePaddingBottom);

  const wrappedComponents = scaledComponents.map(({ content, height, originalWidth, finalScale, align }) => {
    const cleanedContent = content.replace(svgTagRegex, '').trim();
    const looksLikeError = /\b(error|unavailable)\b/i.test(cleanedContent);
    const explicitWidth = Number.isFinite(originalWidth) && originalWidth > 0 ? originalWidth : 0;
    const inferredWidth = looksLikeError && explicitWidth === 0 ? 320 : explicitWidth;
    const scaledWidth = inferredWidth * finalScale;
    const shouldLeftAlign = align === 'left' || looksLikeError;
    const offsetX = shouldLeftAlign
      ? 0
      : Math.max(0, (svgEffectiveWidth - scaledWidth) / 2);

    const block = shouldLeftAlign
      ? `<g transform="translate(0, ${currentY}) scale(${finalScale})">
        ${cleanedContent}
      </g>`
      : `<g transform="translate(${offsetX}, ${currentY}) scale(${finalScale})">
        ${cleanedContent}
      </g>`;

    currentY += height * finalScale + spacing;
    return block;
  });

  const totalHeight = currentY;

  return `
<svg width="${svgEffectiveWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family:${font_family},sans-serif;">
  <rect
    x="${border_width / 2}"
    y="${border_width / 2}"
    width="${svgEffectiveWidth - border_width}"
    height="${totalHeight - border_width}"
    fill="#${bg_color}"
    stroke="#${border_width > 0 ? border_color : 'none'}"
    stroke-width="${border_width}"
    rx="${border_radius}"
    ry="${border_radius}"
  />
  ${scaledTitleBlock}
  ${wrappedComponents.join('\n')}
</svg>`;
}
