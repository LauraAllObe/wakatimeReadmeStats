import fetch from 'node-fetch';

export async function getHeatmapCard({ username, heatmapColor = '00ff00', startDay = 'mo', time = 'y', bg_color = 'ffffff', text_color = '000000' }) {
    const apiKey = process.env.WAKATIME_API_KEY;
    if (!apiKey) {
        throw new Error('Missing WAKATIME_API_KEY in environment variables');
    }
    
    const response = await fetch(`https://wakatime.com/api/v1/users/${username}/durations?range=y`, {
        headers: {
            Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`
        }
    });

    const data = (await response.json());

    // Parse durations and map to weeks/days
    // Use SVG rects with varying `fill-opacity` based on coding time

    return `
        <svg width="700" height="110" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#${bg_color}" />
            <!-- Sample Square -->
            <rect x="20" y="20" width="10" height="10" fill="#${heatmapColor}" fill-opacity="0.6"/>
            <!-- Loop through days and draw more squares -->
        </svg>
    `;
}