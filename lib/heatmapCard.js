export async function getHeatmapCard({
  username,
  heatmap_color = '00ff00',
  start_day = 'mo',
  time = 'last_year'
}) {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) throw new Error('Missing WAKATIME_API_KEY');

  const resp = await fetch(
    `https://wakatime.com/api/v1/users/${username}/stats/${time}?is_including_today=true`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
      }
    }
  );

  const json = await resp.json();
  const stats = json.data;

  if (!resp.ok || !stats?.is_up_to_date) {
    throw new Error('WakaTime stats are not available or are still updating. Please retry later.');
  }

  const daily = stats.days;
  if (!daily || daily.length === 0) {
    throw new Error('No per-day data available.');
  }

  const byDate = daily.reduce((acc, day) => {
    acc[day.date] = day.grand_total.total_seconds;
    return acc;
  }, {});
  const max = Math.max(...Object.values(byDate), 0);

  const today = new Date();
  const daysArr = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d;
  }).reverse();

  const dayOffset = start_day === 'su' ? 0 : 1;

  const cells = daysArr.map(d => {
    const week = Math.floor((d.getTime() / 86400000 + dayOffset) / 7);
    const weekday = (d.getDay() + 6) % 7;
    const key = d.toISOString().slice(0, 10);
    const secs = byDate[key] || 0;
    const opacity = max ? ((secs / max) * 0.9 + 0.1).toFixed(2) : 0;
    return `<rect x="${week * 12 + 20}" y="${weekday * 12 + 20}" width="10" height="10" fill="#${heatmap_color}" fill-opacity="${opacity}" />`;
  }).join('\n');

  const height = 20 + 7 * 12 + 20;

  return {
    content: cells,
    height
  };
}