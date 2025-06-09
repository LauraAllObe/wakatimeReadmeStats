import fetch from 'node-fetch';

export async function getBasicStatsCard({ username, bg_color = 'ffffff', text_color = '000000', hideLanguages = false }) {
    const response = await fetch(`https://wakatime.com/api/v1/users/${username}/stats/last_year`);
    const stats = await response.json().data;

    return `
        <svg width="560" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#${bg_color}" />
            <text x="20" y="30" fill="#${text_color}" font-size="18">WakaTime Stats</text>
            <text x="20" y="60" fill="#${text_color}">Total Time: ${stats.total_seconds_readable}</text>
            <text x="20" y="80" fill="#${text_color}">Daily Average: ${stats.daily_average_readable}</text>
            ${!hideLanguages ? `<text x="20" y="100" fill="#${text_color}">Top Language: ${stats.languages[0]?.name || 'N/A'}</text>` : ''}
        </svg>
    `;
}