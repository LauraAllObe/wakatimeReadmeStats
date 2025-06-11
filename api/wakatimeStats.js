import { svgContainer } from '../lib/svgContainer.js';
import { getHeatmapCard } from '../lib/heatmapCard.js';
import { getBasicStatsCard } from '../lib/basicStatsCard.js';
import 'dotenv/config';

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === true;
}

function parseNumber(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseComponentParams(queryString) {
  const params = new URLSearchParams(queryString);
  const obj = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }
  return obj;
}

export default async function handler(req, res) {
  const { username, components = 1 } = req.query;
  if (!username) return res.status(400).send('Missing username.');

  try {
    const sharedStyles = {
      username,
      bg_color: req.query.bg_color || 'ffffff',
      title_color: req.query.title_color || '333333',
      text_color: req.query.text_color || '999999',
      logo_color: req.query.logo_color || '000000',
      font_family: req.query.font_family || 'Calibri',
      width: parseNumber(req.query.width, 350),
      border_color: req.query.border_color || '333333',
      border_width: parseNumber(req.query.border_width, 1),
      border_radius: parseNumber(req.query.border_radius, 4),
      show_logo: parseBoolean(req.query.show_logo ?? req.query.showLogo, true)
    };

    const count = Math.min(parseInt(components, 10), 3);
    const svgParts = [];

    for (let i = 1; i <= count; i++) {
      const raw = req.query[`component${i}`];
      if (!raw) continue;

      const componentOptions = parseComponentParams(raw);
      const type = componentOptions.type;

      try {
        let result;
        if (type === 'basic') {
          result = await getBasicStatsCard({
            ...sharedStyles,
            ...componentOptions,
            hide_languages: parseBoolean(componentOptions.hide_languages, false),
            hide_projects: parseBoolean(componentOptions.hide_projects, false),
            hide_operating_systems: parseBoolean(componentOptions.hide_operating_systems, false),
            hide_most_active_day: parseBoolean(componentOptions.hide_most_active_day, false)
          });
        } else if (type === 'heatmap') {
          result = await getHeatmapCard({
            ...sharedStyles,
            ...componentOptions
          });
        } else {
          svgParts.push({
            content: `<text x="20" y="20" fill="red">Invalid component type: ${type}</text>`,
            height: 40
          });
          continue;
        }

        svgParts.push({ content: result.content, height: result.height });
      } catch (err) {
        console.error(`Component ${i} (${type}) error:`, err.message || err);

        svgParts.push({
          content: `
            <text x="20" y="20" fill="black" font-size="14">
              ${type === 'heatmap'
                ? '⚠︎ Heatmap Error: ' + (err.message || 'Unavailable')
                : '⚠︎ Error: ' + (err.message || 'Unavailable')}
            </text>`,
          height: 40
        });
      }
    }

    const finalSvg = svgContainer({
      ...sharedStyles,
      components: svgParts
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(finalSvg);

  } catch (err) {
    console.error("Server error:", err.message || err);
    const errorSvg = `
<svg width="700" height="120" xmlns="http://www.w3.org/2000/svg" style="font-family:Calibri,sans-serif;font-size:14;">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="20" y="40" fill="#333333" font-size="18" font-weight="bold">WakaTime Error</text>
  <text x="20" y="70" fill="#333333">${err.message || "Unknown error occurred."}</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(errorSvg);
  }
}