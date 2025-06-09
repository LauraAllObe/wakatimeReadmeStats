import fetch from 'node-fetch';

function formatDate(dateStr) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const [year, month, day] = dateStr.split('-').map(Number);

    const suffix = (d) => {
        if (d > 3 && d < 21) return 'th';
        switch (d % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    return `${day}${suffix(day)} ${months[month - 1]}, ${year}`;
}

export async function getBasicStatsCard({
    username,
    bg_color = 'ffffff',
    title_color = '333333',
    text_color = '999999',
    font_family = 'Calibri',
    width = '400',
    showLogo = true,
    hideLanguages = false,
    hideProjects = false,
    hideOperatingSystems = false,
    hideMostActiveDay = false
}) {
    const apiKey = process.env.WAKATIME_API_KEY;
    if (!apiKey) {
        throw new Error('Missing WAKATIME_API_KEY in environment variables');
    }

    const authHeader = {
        headers: {
            Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
        }
    };

    let totalTimeLastYear = 'N/A';
    let dailyAvg = 'N/A';
    let languages = 'N/A';
    let projects = 'N/A';
    let operatingSystems = 'N/A';
    let mostActiveDay = 'N/A';

    try {
        const lastYearRes = await fetch(`https://wakatime.com/api/v1/users/${username}/stats/last_year`, authHeader);
        const lastYearStats = (await lastYearRes.json()).data;

        totalTimeLastYear = lastYearStats?.human_readable_total || 'N/A';
        dailyAvg = lastYearStats?.human_readable_daily_average || 'N/A';
        languages = lastYearStats?.languages?.slice(0, 3).map(l => l.name).join(', ') || 'N/A';
        projects = lastYearStats?.projects?.slice(0, 3).map(p => p.name).join(', ') || 'N/A';
        operatingSystems = lastYearStats?.operating_systems?.slice(0, 3).map(o => o.name).join(', ') || 'N/A';

        const rawDate = lastYearStats?.best_day?.date;
        mostActiveDay = rawDate ? formatDate(rawDate) : 'N/A';

    } catch (err) {
        console.error('WakaTime fetch error:', err);
        throw new Error('Failed to fetch WakaTime stats');
    }

    const logoUrl = 'https://raw.githubusercontent.com/LauraAllObe/wakatimeReadmeStats/main/static/wakatime.svg';

    const titleLine = showLogo
        ? `<image href="${logoUrl}" x="20" y="12" height="20" width="20" /><text x="50" y="28" fill="#${title_color}" font-size="16">WakaTime Stats</text>`
        : `<text x="20" y="30" fill="#${title_color}" font-size="16">WakaTime Stats</text>`;

    const lines = [
        titleLine,
        `<text x="20" y="60" fill="#${text_color}"><tspan font-weight="bold">Total Time (Last Year):</tspan> ${totalTimeLastYear}</text>`,
        `<text x="20" y="85" fill="#${text_color}"><tspan font-weight="bold">Daily Average:</tspan> ${dailyAvg}</text>`
    ];

    let y = 110;
    const step = 25;

    if (!hideLanguages) {
        lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Top Languages:</tspan> ${languages}</text>`);
        y += step;
    }
    if (!hideProjects) {
        lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Top Projects:</tspan> ${projects}</text>`);
        y += step;
    }
    if (!hideOperatingSystems) {
        lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Top OS:</tspan> ${operatingSystems}</text>`);
        y += step;
    }
    if (!hideMostActiveDay) {
        lines.push(`<text x="20" y="${y}" fill="#${text_color}"><tspan font-weight="bold">Most Active Day:</tspan> ${mostActiveDay}</text>`);
        y += step;
    }

    const calculatedHeight = y + 20;

    return `
        <svg width="${width}" height="${calculatedHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: ${font_family}, sans-serif; font-size: 12;">
            <rect width="100%" height="100%" fill="#${bg_color}" />
            ${lines.join('\n')}
        </svg>
    `;
}