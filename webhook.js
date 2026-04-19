// =====================================================
// ROYCE FAMILY - WEBHOOK INTEGRATION
// Discord + Telegram notifications for applications
// =====================================================

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1495157365560053902/TgfSxctBsJWCbXSoYCCueQjaLfHZIraEGL5Jxxgahr6JOcqKZBDxS-9jjTOLCfDQBsMS';

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '8226759269:AAE4DyaZAxxn9iHcsgGr3xtty9bGCjyiIpQ';
const TELEGRAM_CHAT_ID = '1601213844';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getExperienceLabel(value) {
  const map = {
    newbie: 'Новичок (меньше месяца)',
    intermediate: 'Есть опыт (1–6 месяцев)',
    experienced: 'Опытный игрок (6+ месяцев)',
    veteran: 'Ветеран RP'
  };
  return map[value] || value || '—';
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function escapeHtml(text) {
  if (!text) return '—';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// =====================================================
// TELEGRAM INTEGRATION
// =====================================================

async function sendTelegramMessage(text, parseMode = 'HTML') {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram credentials not configured');
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram API error:', error);
      return false;
    }
    
    console.log('✅ Telegram notification sent');
    return true;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('Telegram request timeout');
    } else {
      console.error('Telegram send error:', error);
    }
    return false;
  }
}

function formatTelegramApplication(data) {
  const date = formatDate(new Date());
  
  return `📥 <b>Новая заявка в Royce Family</b>

👤 <b>Никнейм:</b> ${escapeHtml(data.nickname)}
💬 <b>Discord:</b> ${escapeHtml(data.discord)}
🎂 <b>Возраст:</b> ${data.age || '—'}
🌍 <b>Часовой пояс:</b> ${escapeHtml(data.timezone) || '—'}
🎮 <b>Опыт:</b> ${escapeHtml(getExperienceLabel(data.experience))}

📝 <b>Почему хочет вступить:</b>
<i>${escapeHtml(data.reason)}</i>

📅 <b>Дата:</b> ${date}`;
}

function formatTelegramStatusUpdate(data, status, rejectReason = null) {
  const statusEmoji = status === 'accepted' ? '✅' : '❌';
  const statusText = status === 'accepted' ? 'ПРИНЯТА' : 'ОТКЛОНЕНА';
  
  let message = `${statusEmoji} <b>Заявка ${statusText}</b>

👤 <b>Никнейм:</b> ${escapeHtml(data.nickname)}
💬 <b>Discord:</b> ${escapeHtml(data.discord)}`;

  if (status === 'rejected' && rejectReason) {
    message += `\n\n❗ <b>Причина отклонения:</b>\n<i>${escapeHtml(rejectReason)}</i>`;
  }

  return message;
}

// =====================================================
// DISCORD INTEGRATION (original code preserved)
// =====================================================

async function postDiscordEmbed(embed) {
  if (!DISCORD_WEBHOOK) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      console.error('Discord webhook error:', response.status, response.statusText);
      return false;
    }
    console.log('✅ Discord notification sent');
    return true;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('Discord request timeout');
    } else {
      console.error('Discord send error:', error);
    }
    return false;
  }
}

function buildDiscordApplicationEmbed(data) {
  return {
    title: '📥 Новая заявка',
    color: 0xc9a85d,
    fields: [
      { name: '👤 Никнейм', value: data.nickname || '—', inline: true },
      { name: '💬 Discord', value: data.discord || '—', inline: true },
      { name: '🎂 Возраст', value: String(data.age) || '—', inline: true },
      { name: '🌍 Часовой пояс', value: data.timezone || '—', inline: true },
      { name: '🎮 Опыт в RP', value: getExperienceLabel(data.experience), inline: true },
      { name: '📝 Причина вступления', value: data.reason || '—' }
    ],
    footer: { text: 'Royce Family Application System' },
    timestamp: new Date().toISOString()
  };
}

function buildDiscordStatusEmbed(data, status, rejectReason = null) {
  const isAccepted = status === 'accepted';
  const embed = {
    title: isAccepted ? '✅ Заявка принята' : '❌ Заявка отклонена',
    color: isAccepted ? 0x37c6a0 : 0xff6f6f,
    fields: [
      { name: '👤 Никнейм', value: data.nickname || '—', inline: true },
      { name: '💬 Discord', value: data.discord || '—', inline: true }
    ],
    footer: { text: 'Royce Family Application System' },
    timestamp: new Date().toISOString()
  };

  if (!isAccepted && rejectReason) {
    embed.fields.push({ name: '❗ Причина отклонения', value: rejectReason });
  }

  return embed;
}

// =====================================================
// PUBLIC API - Send to both Discord and Telegram
// =====================================================

/**
 * Send new application notification to Discord and Telegram
 * @param {Object} data - Application data
 * @returns {Promise<{discord: boolean, telegram: boolean}>}
 */
async function sendApplicationNotification(data) {
  const results = await Promise.allSettled([
    postDiscordEmbed(buildDiscordApplicationEmbed(data)),
    sendTelegramMessage(formatTelegramApplication(data))
  ]);

  return {
    discord: results[0].status === 'fulfilled' && results[0].value,
    telegram: results[1].status === 'fulfilled' && results[1].value
  };
}

/**
 * Send status update notification to Discord and Telegram
 * @param {Object} data - Application data
 * @param {string} status - 'accepted' or 'rejected'
 * @param {string|null} rejectReason - Rejection reason (if rejected)
 * @returns {Promise<{discord: boolean, telegram: boolean}>}
 */
async function sendStatusNotification(data, status, rejectReason = null) {
  const results = await Promise.allSettled([
    postDiscordEmbed(buildDiscordStatusEmbed(data, status, rejectReason)),
    sendTelegramMessage(formatTelegramStatusUpdate(data, status, rejectReason))
  ]);

  return {
    discord: results[0].status === 'fulfilled' && results[0].value,
    telegram: results[1].status === 'fulfilled' && results[1].value
  };
}

// =====================================================
// EXPORTS (for use in other files)
// =====================================================

// For browser (attach to window)
if (typeof window !== 'undefined') {
  window.RoyceWebhook = {
    sendApplicationNotification,
    sendStatusNotification,
    // Legacy support (for existing code)
    sendApplication: sendApplicationNotification,
    notifyStatus: sendStatusNotification
  };
}

// For Node.js modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendApplicationNotification,
    sendStatusNotification,
    sendTelegramMessage,
    postDiscordEmbed,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID
  };
}
