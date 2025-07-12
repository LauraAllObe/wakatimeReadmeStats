import { svgContainer } from '../lib/svgContainer.js';
import { getHeatmapCard } from '../lib/heatmapCard.js';
import { getBasicStatsCard } from '../lib/basicStatsCard.js';
import { getCodingActivityCard } from '../lib/codingActivityCard.js';
import {getSpedometerCard} from '../lib/spedometerCard.js';
import { getStarRankCard } from '../lib/starRankCard.js';
import { getWeekdayAverageCard } from '../lib/weekdayAverageCard.js';
import { getProjectBreakdownCard } from '../lib/projectBreakdownCard.js';
import { getLanguageBreakdownCard } from '../lib/languageBreakdownCard.js';
import { getAlltimeLanguagesCard } from '../lib/alltimeLanguagesCard.js';
import {getAlltimeProjectsCard } from '../lib/alltimeProjectsCard.js';
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
    const api_key_2 = process.env.WAKATIME_API_KEY ?? '';
    const apiKey = req.query.api_key || api_key_2;
    if (!apiKey || apiKey === '') throw new Error('Missing WAKATIME_API_KEY');

    const sharedStyles = {
      username,
      api_key: apiKey || '',
      bg_color: req.query.bg_color || 'fffbea',
      title_color: req.query.title_color || '6b4e16',
      text_color: req.query.text_color || '4b3b0c',
      logo_color: req.query.logo_color || 'a68b2c',
      font_family: req.query.font_family || 'Calibri',
      border_color: req.query.border_color || 'e0d3a8',
      border_width: parseNumber(req.query.border_width, 2),
      border_radius: parseNumber(req.query.border_radius, 10),
      show_logo: parseBoolean(req.query.show_logo, true),
      title_prefix: req.query.title_prefix || ''
    };

    const count = Math.min(parseInt(components, 10), 10);
    const svgParts = [];
    let maxComponentWidth = 0;


    for (let i = 1; i <= count; i++) {
      let componentOptions = {};
      const raw = req.query[`component${i}`];

      if (raw) {
        // fallback: parse full query string
        componentOptions = parseComponentParams(raw);
      } else {
        // new structure
        const prefix = `component${i}_`;
        for (const [key, value] of Object.entries(req.query)) {
          if (key.startsWith(prefix)) {
            const subKey = key.slice(prefix.length);
            componentOptions[subKey] = value;
          }
        }
      }
      if (!componentOptions.type) continue;

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
            heatmap_color: componentOptions.heatmap_color ?? 'e0d3a8',
            start_day: componentOptions.start_day ?? 'mo',
            heading_type: componentOptions.heading_type ?? 'friendly',
            hide_title: parseBoolean(componentOptions.hide_title, false)
          });
        } else if (type === 'weekly') {
          result = await getCodingActivityCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type ?? 'bar',
            chart_color: componentOptions.chart_color ?? '#a67c52',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line, true),
            start_day: componentOptions.start_day ?? '-7',
            heading_type: componentOptions.heading_type ?? 'friendly',
            custom_heading: componentOptions.custom_heading ?? '',
            mixed_colors: parseBoolean(componentOptions.mixed_colors, false),
            hide_legend: parseBoolean(componentOptions.hide_legend, false),
            hide_total: parseBoolean(componentOptions.hide_total, false),
            hide_time: parseBoolean(componentOptions.hide_time, false),
            hide_percentage: parseBoolean(componentOptions.hide_percentage, false),
            hide_title: parseBoolean(componentOptions.hide_title, false),
            y_axis: parseBoolean(componentOptions.y_axis, false),
            y_axis_label: parseBoolean(componentOptions.y_axis_label, false),
            custom_days: componentOptions.custom_days ?? ''
          });
        } else if (type === 'weekly_projs') {
          result = await getProjectBreakdownCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type ?? 'bar',
            chart_color: componentOptions.chart_color ?? '#a67c52',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line, true),
            start_day: componentOptions.start_day ?? '-7',
            heading_type: componentOptions.heading_type ?? 'friendly',
            hide_legend: parseBoolean(componentOptions.hide_legend, false),
            hide_total: parseBoolean(componentOptions.hide_total, false),
            hide_time: parseBoolean(componentOptions.hide_time, true),
            hide_percentage: parseBoolean(componentOptions.hide_percentage, true),
            hide_title: parseBoolean(componentOptions.hide_title, false),
            y_axis: parseBoolean(componentOptions.y_axis, true),
            y_axis_label: parseBoolean(componentOptions.y_axis_label, true),
          });
        } else if (type === 'weekly_langs') {
          result = await getLanguageBreakdownCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type ?? 'bar',
            chart_color: componentOptions.chart_color ?? '#a67c52',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line, true),
            start_day: componentOptions.start_day ?? '-7',
            heading_type: componentOptions.heading_type ?? 'friendly',
            hide_legend: parseBoolean(componentOptions.hide_legend, false),
            hide_total: parseBoolean(componentOptions.hide_total, false),
            hide_time: parseBoolean(componentOptions.hide_time, true),
            hide_percentage: parseBoolean(componentOptions.hide_percentage, true),
            hide_title: parseBoolean(componentOptions.hide_title, false),
            y_axis: parseBoolean(componentOptions.y_axis, true),
            y_axis_label: parseBoolean(componentOptions.y_axis_label, true),
          });
        } else if (type === 'weekly_avg') {
          result = await getWeekdayAverageCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type ?? 'bar',
            chart_color: componentOptions.chart_color ?? '#a67c52',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line, true),
            start_day: componentOptions.start_day ?? 'mo',
            heading_type: componentOptions.heading_type ?? 'friendly',
            mixed_colors: parseBoolean(componentOptions.mixed_colors, false),
            hide_legend: parseBoolean(componentOptions.hide_legend, false),
            hide_total: parseBoolean(componentOptions.hide_total, false),
            hide_time: parseBoolean(componentOptions.hide_time, false),
            hide_percentage: parseBoolean(componentOptions.hide_percentage, false),
            hide_title: parseBoolean(componentOptions.hide_title, false),
            y_axis: parseBoolean(componentOptions.y_axis, false),
            y_axis_label: parseBoolean(componentOptions.y_axis_label, false),
          });
        } else if (type === 'all_langs') {
          result = await getAlltimeLanguagesCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type ?? 'bar_vertical',
            chart_color: componentOptions.chart_color ?? '#a67c52',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line, true),
            heading_type: componentOptions.heading_type ?? 'friendly',
            mixed_colors: parseBoolean(componentOptions.mixed_colors, false),
            num_langs: componentOptions.num_langs ?? '10',
            hide_legend: parseBoolean(componentOptions.hide_legend, false),
            hide_total: parseBoolean(componentOptions.hide_total, false),
            hide_time: parseBoolean(componentOptions.hide_time, false),
            hide_percentage: parseBoolean(componentOptions.hide_percentage, false),
            hide_title: parseBoolean(componentOptions.hide_title, false),
            y_axis: parseBoolean(componentOptions.y_axis, false),
            y_axis_label: parseBoolean(componentOptions.y_axis_label, false),
          });
        } else if (type === 'all_projs') {
          result = await getAlltimeProjectsCard({
            ...sharedStyles,
            ...componentOptions,
            chart_type: componentOptions.chart_type ?? 'bar_vertical',
            chart_color: componentOptions.chart_color ?? '#a67c52',
            chart_curved_line: parseBoolean(componentOptions.chart_curved_line, true),
            heading_type: componentOptions.heading_type ?? 'friendly',
            mixed_colors: parseBoolean(componentOptions.mixed_colors, false),
            num_projs: componentOptions.num_projs ?? '10',
            hide_legend: parseBoolean(componentOptions.hide_legend, false),
            hide_total: parseBoolean(componentOptions.hide_total, false),
            hide_time: parseBoolean(componentOptions.hide_time, false),
            hide_percentage: parseBoolean(componentOptions.hide_percentage, false),
            hide_title: parseBoolean(componentOptions.hide_title, false),
            y_axis: parseBoolean(componentOptions.y_axis, false),
            y_axis_label: parseBoolean(componentOptions.y_axis_label, false),
          });
        } else if (type === 'spedometer') {
          result = await getSpedometerCard({
            ...sharedStyles,
            ...componentOptions,
            difficulty: componentOptions.difficulty ?? 'medium',
            label_type: componentOptions.label_type ?? 'standard',
            chart_color: componentOptions.chart_color ?? '#a67c52',
            custom_emojis: componentOptions.custom_emojis ?? '',
            show_high_score: componentOptions.show_high_score ?? true
          });
        } else if (type === 'rank') {
          result = await getStarRankCard({
            ...sharedStyles,
            ...componentOptions,
            rank_color: componentOptions.rank_color ?? '#a67c52',
            hide_title: parseBoolean(componentOptions.hide_title, false)
          });
        } else {
          svgParts.push({
            content: `<text x="20" y="20" fill="red">Invalid component type: ${type}</text>`,
            height: 40
          });
          continue;
        }

        svgParts.push({
          ...result,
          type // <- pass the type from componentOptions
        });
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
          height: 40,
          width: 0,
          type
        });
      }
    }
    const scale = parseBoolean(req.query.scale, false);
    // extract title_scale_value
    const title_scale_value = parseFloat(req.query.title_scale_value ?? '0.65');

    // extract scale values for components
    const componentScaleValues = {};
    for (let i = 1; i <= count; i++) {
      const key = `component${i}_scale_value`;
      if (req.query[key]) {
        const val = parseFloat(req.query[key]);
        if (!isNaN(val)) {
          componentScaleValues[i - 1] = val; // index 0-based
        }
      }
    }

    const finalSvg = svgContainer({
      ...sharedStyles,
      width: Math.max(sharedStyles.width, maxComponentWidth),
      components: svgParts,
      scale,
      title_scale_value,
      component_scale_values: componentScaleValues
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