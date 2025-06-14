import fs from 'fs';
import path from 'path';

export function svgContainer({
  width = 350,
  border_color = '333333',
  border_width = 1,
  border_radius = 4,
  bg_color = 'ffffff',
  font_family = 'Calibri',
  show_logo = true,
  logo_color = '000000',
  title_color = '333333',
  title_prefix = '',
  components = []
}) {
  const spacing = 20;
  const titleHeight = 40;

  let logoSvg = '';
  if (show_logo) {
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

  const titleText = `${title_prefix || ''} WakaTime Stats`.trim();

const title = show_logo
  ? `${logoSvg}<text x="45" y="28" fill="#${title_color}" font-size="16" font-family="${font_family}">${titleText}</text>`
  : `<text x="20" y="30" fill="#${title_color}" font-size="16" font-family="${font_family}">${titleText}</text>`;

  let currentY = titleHeight;
  const wrappedComponents = components.map(({ content, height }) => {
    const block = `<g transform="translate(0, ${currentY})">${content}</g>`;
    currentY += height + spacing;
    return block;
  });

  const totalHeight = currentY;

  return `
<svg width="${width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family:${font_family},sans-serif;">
  <rect
    x="${border_width / 2}"
    y="${border_width / 2}"
    width="${width - border_width}"
    height="${totalHeight - border_width}"
    fill="#${bg_color}"
    stroke="#${border_width > 0 ? border_color : 'none'}"
    stroke-width="${border_width}"
    rx="${border_radius}"
    ry="${border_radius}"
  />
  ${title}
  ${wrappedComponents.join('\n')}
</svg>`;
}
