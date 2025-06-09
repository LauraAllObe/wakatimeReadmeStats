import { getHeatmapCard } from '../lib/heatmapCard.js';
import { getBasicStatsCard } from '../lib/basicStatsCard.js';
import 'dotenv/config';

export default async function handler(req, res) {
    const { username, type } = req.query;

    if (!username || !type) {
        return res.status(400).send('Missing username or type.');
    }

    try {
        let svg;
        if (type === 'heatmap') {
            svg = await getHeatmapCard(req.query);
        } else if (type === 'basic') {
            svg = await getBasicStatsCard(req.query);
        } else {
            return res.status(400).send('Invalid type.');
        }

        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating card.');
    }
}