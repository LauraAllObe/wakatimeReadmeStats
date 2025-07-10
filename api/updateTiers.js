import { exec } from 'child_process';

export default async function handler(req, res) {
  exec('node updateTierThresholds.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Cron error:', error);
      return res.status(500).send('Error running update');
    }
    console.log(stdout);
    return res.status(200).send('Update successful');
  });
}
