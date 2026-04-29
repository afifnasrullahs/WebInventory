function maskSecret(str, keepStart = 6, keepEnd = 4) {
  if (!str) return '';
  const s = String(str);
  if (s.length <= keepStart + keepEnd) return '*'.repeat(s.length);
  return `${s.slice(0, keepStart)}${'*'.repeat(Math.max(4, s.length - keepStart - keepEnd))}${s.slice(-keepEnd)}`;
}

async function sendDiscordWebhook(webhookUrl, payload, { timeoutMs = 6000 } = {}) {
  if (!webhookUrl) return { skipped: true, reason: 'missing_webhook_url' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Discord webhooks often return 204 No Content on success
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`Discord webhook failed: ${res.status} ${res.statusText} ${body}`.trim());
      err.status = res.status;
      throw err;
    }

    return { ok: true, status: res.status };
  } catch (err) {
    err.webhook = maskSecret(webhookUrl);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { sendDiscordWebhook };

