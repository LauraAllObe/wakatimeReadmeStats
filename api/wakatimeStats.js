import { svgContainer } from '../lib/svgContainer.js';
import { getHeatmapCard } from '../lib/heatmapCard.js';
import { getBasicStatsCard } from '../lib/basicStatsCard.js';
import { getCodingActivityCard } from '../lib/codingActivityCard.js';
import {getSpedometerCard} from '../lib/spedometerCard.js';
import { getStarRankCard } from '../lib/starRankCard.js';
import { getWeekdayAverageCard } from '../lib/weekdayAverageCard.js';
import { getProjectBreakdownCard } from '../lib/projectBreakdownCard.js';
import { getLanguageBreakdownCard } from '../lib/languageBreakdownCard.js';
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
      show_logo: parseBoolean(req.query.show_logo ?? req.query.showLogo, true),
      title_prefix: req.query.title_prefix || ''
    };

    const count = Math.min(parseInt(components, 10), 3);
    const svgParts = [];
    let maxComponentWidth = 0;


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
            hide_daily_average: parseBoolean(componentOptions.hide_daily_average, false),
            hide_total_time: parseBoolean(componentOptions.hide_total_time, false),
            hide_languages: parseBoolean(componentOptions.hide_languages, false),
            hide_projects: parseBoolean(componentOptions.hide_projects, false),
            hide_operating_systems: parseBoolean(componentOptions.hide_operating_systems, false),
            hide_most_active_day: parseBoolean(componentOptions.hide_most_active_day, false)
          });
        } else if (type === 'heatmap') {
          result = await getHeatmapCard({
            ...sharedStyles,
            ...componentOptions,
            heatmap_color: componentOptions.heatmap_color || '00ff00',
            start_day: componentOptions.start_day || 'mo',
            time: componentOptions.time || 'last_year',
            heading_type: componentOptions.heading_type || 'friendly',
            hide_title: parseBoolean(componentOptions.hide_title, false)
          });
        } else if (type === 'last7') {
          result = await getCodingActivityCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type || 'bar',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line),
            start_day: componentOptions.start_day || '-7',
            heading_type: componentOptions.heading_type || 'friendly',
            mixed_colors: parseBoolean(componentOptions.mixed_colors),
            hide_legend: parseBoolean(componentOptions.hide_legend),
            hide_total: parseBoolean(componentOptions.hide_total),
            hide_time: parseBoolean(componentOptions.hide_time),
            hide_percentage: parseBoolean(componentOptions.hide_percentage),
            hide_title: parseBoolean(componentOptions.hide_title),
          });
        } else if (type === 'project') {
          result = await getProjectBreakdownCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type || 'bar',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line),
            start_day: componentOptions.start_day || '-7',
            heading_type: componentOptions.heading_type || 'friendly',
            mixed_colors: parseBoolean(componentOptions.mixed_colors),
            hide_legend: parseBoolean(componentOptions.hide_legend),
            hide_total: parseBoolean(componentOptions.hide_total),
            hide_time: parseBoolean(componentOptions.hide_time),
            hide_percentage: parseBoolean(componentOptions.hide_percentage),
            hide_title: parseBoolean(componentOptions.hide_title),
          });
        } else if (type === 'language') {
          result = await getLanguageBreakdownCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type || 'bar',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line),
            start_day: componentOptions.start_day || '-7',
            heading_type: componentOptions.heading_type || 'friendly',
            mixed_colors: parseBoolean(componentOptions.mixed_colors),
            hide_legend: parseBoolean(componentOptions.hide_legend),
            hide_total: parseBoolean(componentOptions.hide_total),
            hide_time: parseBoolean(componentOptions.hide_time),
            hide_percentage: parseBoolean(componentOptions.hide_percentage),
            hide_title: parseBoolean(componentOptions.hide_title),
          });
        } else if (type === 'spedometer') {
          result = await getSpedometerCard({
            ...sharedStyles,
            ...componentOptions,
            difficulty: componentOptions.difficulty || 'medium',
            label_type: componentOptions.label_type || 'standard',
            chart_color: componentOptions.chart_color || '#f1c40f',
            custom_emojis: componentOptions.custom_emojis || '',
            show_high_score: componentOptions.show_high_score ?? true
          });
        } else if (type === 'star_rank') {
          result = await getStarRankCard({
            ...sharedStyles,
            ...componentOptions,
            rank_color: componentOptions.rank_color || '#FFD700',
            hide_title: parseBoolean(componentOptions.hide_title, false)
          });
        } else if (type === 'weekday_avg') {
          result = await getWeekdayAverageCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type || 'bar',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line),
            start_day: componentOptions.start_day || 'mo',
            heading_type: componentOptions.heading_type || 'friendly',
            mixed_colors: parseBoolean(componentOptions.mixed_colors),
            hide_legend: parseBoolean(componentOptions.hide_legend),
            hide_total: parseBoolean(componentOptions.hide_total),
            hide_time: parseBoolean(componentOptions.hide_time),
            hide_percentage: parseBoolean(componentOptions.hide_percentage),
            hide_title: parseBoolean(componentOptions.hide_title),
          });
        } else {
          svgParts.push({
            content: `<text x="20" y="20" fill="red">Invalid component type: ${type}</text>`,
            height: 40
          });
          continue;
        }

        svgParts.push({ content: result.content, height: result.height });
        if (result.width) {
          maxComponentWidth = Math.max(maxComponentWidth, result.width);
        }
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
      width: Math.max(sharedStyles.width, maxComponentWidth),
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