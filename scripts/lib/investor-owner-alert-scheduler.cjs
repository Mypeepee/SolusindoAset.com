/** The owner-alert worker is independent of visits to the Investor page. */
function startInvestorOwnerAlertScheduler(port, dependencies = {}) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[investor-owner-alerts] CRON_SECRET belum diatur; scheduler tidak dimulai.');
    return;
  }
  const cron = dependencies.cron || require('node-cron');
  const http = dependencies.http || require('node:http');
  let running = false;
  const trigger = () => {
    if (running) return;
    running = true;
    const request = http.request({ hostname: 'localhost', port,
      path: '/api/cron/investor-owner-alerts', method: 'POST',
      headers: { Authorization: `Bearer ${secret}` }, timeout: 300000 }, (response) => {
      let body = '';
      response.on('data', (chunk) => { if (body.length < 16384) body += chunk; });
      response.on('end', () => {
        running = false;
        if (response.statusCode !== 200) {
          console.error('[investor-owner-alerts] HTTP', response.statusCode);
          return;
        }
        try {
          const result = JSON.parse(body);
          if (result.emailsSent || result.failed || result.uncertain)
            console.log(`[investor-owner-alerts] email=${result.emailsSent} aset=${result.assetsSent} gagal=${result.failed} belum-pasti=${result.uncertain}`);
        } catch { console.error('[investor-owner-alerts] Respons tidak valid.'); }
      });
      response.on('error', () => { running = false; });
    });
    request.on('error', (error) => { running = false; console.error('[investor-owner-alerts]', error.code || 'REQUEST_FAILED'); });
    request.on('timeout', () => request.destroy(new Error('Owner alert timeout')));
    request.end();
  };
  const task = cron.schedule('*/15 * * * *', trigger, { timezone: 'Asia/Jakarta' });
  console.log('> Scheduler email Investor ke owner aktif (cek /15 menit, jeda email minimal 1 jam)');
  return task;
}
module.exports = { startInvestorOwnerAlertScheduler };
