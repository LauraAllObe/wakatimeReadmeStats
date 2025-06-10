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

export default async function handler(req, res) {
  const { username, type } = req.query;

  if (!username || !type) {
    return res.status(400).send('Missing username or type.');
  }

  try {
    let svg;
    if (type === 'heatmap') {
      svg = await getHeatmapCard(req.query); // Adjust if you add options later
    } else if (type === 'basic') {
      // Parse and sanitize options
      const options = {
        username,
        bg_color: req.query.bg_color || 'ffffff',
        title_color: req.query.title_color || '333333',
        text_color: req.query.text_color || '999999',
        logo_color: req.query.logo_color || '000000',
        font_family: req.query.font_family || 'Calibri',
        width: parseNumber(req.query.width, 400),
        showLogo: parseBoolean(req.query.showLogo, true),
        hideLanguages: parseBoolean(req.query.hideLanguages, false),
        hideProjects: parseBoolean(req.query.hideProjects, false),
        hideOperatingSystems: parseBoolean(req.query.hideOperatingSystems, false),
        hideMostActiveDay: parseBoolean(req.query.hideMostActiveDay, false)
      };

      svg = await getBasicStatsCard(options);
    } else {
      return res.status(400).send('Invalid type.');
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
    } catch (err) {
        console.error(err);

        // Custom SVG fallback message
        const errorSvg = `
    <svg width="700" height="120" xmlns="http://www.w3.org/2000/svg" style="font-family:Calibri,sans-serif;font-size:14;">
    <rect width="100%" height="100%" fill="#ffffff" />
    <text x="20" y="40" fill="#333333" font-size="18" font-weight="bold">WakaTime Error</text>
    <text x="20" y="70" fill="#333333">No per-day data available. Consider upgrading to WakaTime Premium</text>
    <text x="20" y="90" fill="#333333">or stay logged-in to wakatime.com and ensure your API key is valid.</text>
    </svg>
        `;

        res.setHeader('Content-Type', 'image/svg+xml');
        res.status(200).send(errorSvg); // 200 so GitHub still renders the SVG
    }
}