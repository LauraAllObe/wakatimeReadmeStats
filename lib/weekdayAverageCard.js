import { getCodingActivityCard } from './codingActivityCard.js';

function getDayIndex(dayCode) {
  const map = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
  return map[dayCode.toLowerCase()] ?? -1;
}

function reorderDays(days, startDayCode) {
  const targetIndex = getDayIndex(startDayCode);
  if (targetIndex < 0) return days;

  return [...days].sort((a, b) => {
    const getDay = d => getDayIndex(d.range.date);
    const offset = day => (getDay(day) - targetIndex + 7) % 7;
    return offset(a) - offset(b);
  });
}

export async function getWeekdayAverageCard({
  username,
  text_color,
  chart_color,
  chart_type,
  bg_color,
  chart_curved_line,
  start_day,
  heading_type,
  mixed_colors,
  hide_legend,
  hide_total,
  hide_time,
  hide_percentage,
  hide_title,
  y_axis,
  y_axis_label,
}) {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

  const apiUrl = `https://wakatime.com/api/v1/users/${username}/insights/weekdays?range=last_year`;
  console.log('Fetching weekday averages from:', apiUrl);

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
    }
  });

  const json = await res.json();
  console.log('Raw weekday insights response:', JSON.stringify(json, null, 2));

  const weekdayAvg = json?.data?.weekdays;

  if (!weekdayAvg || weekdayAvg.length === 0) {
    console.log('No data returned from insights.weekdays:', json.data);
    throw new Error('No weekday average insight data available.');
  }

  const weekdayToCode = {
    sunday: 'su',
    monday: 'mo',
    tuesday: 'tu',
    wednesday: 'we',
    thursday: 'th',
    friday: 'fr',
    saturday: 'sa'
  };

  let days = weekdayAvg.map(d => {
    const code = weekdayToCode[d.name.toLowerCase()] || d.name;
    console.log(`Mapping weekday "${d.name}" -> "${code}" | average=${d.average}, human_readable=${d.human_readable_average}`);
    return {
      range: { date: code },
      grand_total: {
        total_seconds: d.average,
        text: d.human_readable_average
      }
    };
  });

  console.log('Initial mapped days:', days);

  if (start_day && start_day !== '-7') {
    days = reorderDays(days, start_day);
    console.log(`Reordered days (start_day=${start_day}):`, days.map(d => d.range.date));
  }

  const totalSeconds = days.reduce((sum, d) => sum + d.grand_total.total_seconds, 0);
  const maxSeconds = Math.max(...days.map(d => d.grand_total.total_seconds));
  console.log('Total seconds:', totalSeconds, '| Max seconds:', maxSeconds);

  let headingText = 'Average Weekly Coding Time';
  if (heading_type === 'friendly') {
    const maxDay = days.reduce((a, b) =>
      b.grand_total.total_seconds > a.grand_total.total_seconds ? b : a
    );
    const readable = {
      su: 'Sunday', mo: 'Monday', tu: 'Tuesday', we: 'Wednesday',
      th: 'Thursday', fr: 'Friday', sa: 'Saturday'
    };
    const dayName = readable[maxDay.range.date] || maxDay.range.date;
    headingText = `I'm most productive on ${dayName}s`;
    console.log('Friendly heading text:', headingText);
  }

  return getCodingActivityCard({
    username,
    text_color,
    chart_color,
    chart_type,
    bg_color,
    chart_curved_line,
    start_day,
    heading_type: 'custom',
    mixed_colors,
    hide_legend,
    hide_total,
    hide_time,
    hide_percentage,
    hide_title,
    custom_days: days,
    custom_heading: headingText,
    custom_total: totalSeconds
  });
}
