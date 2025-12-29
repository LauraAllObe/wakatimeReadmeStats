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
  api_key,
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
  chart_color = chart_color.replace(/^#/, '');
  text_color = text_color.replace(/^#/, '');
  const apiKey = api_key ?? '';
  if (!apiKey || apiKey === '') throw new Error('Missing WAKATIME_API_KEY');

  const apiUrl = `https://wakatime.com/api/v1/users/${username}/insights/weekdays?range=last_year`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
    }
  });

  const json = await res.json();

  const weekdayAvg = json?.data?.weekdays;

  if (!weekdayAvg || weekdayAvg.length === 0) {
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
    return {
      range: { date: code },
      grand_total: {
        total_seconds: d.average,
        text: d.human_readable_average
      }
    };
  });


  if (start_day && start_day !== '-7') {
    days = reorderDays(days, start_day);
  }

  const totalSeconds = days.reduce((sum, d) => sum + d.grand_total.total_seconds, 0);
  const maxSeconds = Math.max(...days.map(d => d.grand_total.total_seconds));

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
  }

  return getCodingActivityCard({
    api_key,
    username,
    text_color,
    chart_color,
    chart_type,
    bg_color,
    chart_curved_line,
    start_day,
    heading_type: 'custom',
    custom_heading: headingText,
    mixed_colors,
    hide_legend,
    hide_total,
    hide_time,
    hide_percentage,
    hide_title,
    y_axis,
    y_axis_label,
    custom_days: days,
  });
}
