// =====================================================
// ROYCE FAMILY - WEBHOOK INTEGRATION
// Discord + Telegram notifications for applications
// =====================================================

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1495157365560053902/TgfSxctBsJWCbXSoYCCueQjaLfHZIraEGL5Jxxgahr6JOcqKZBDxS-9jjTOLCfDQBsMS';

// Telegram Bot Configuration - @Royce_fmq_bot
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
  return String(text)
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

📅 <b>Дата:</b> ${date}
🆔 <b>ID заявки:</b> <code>${data.id || Date.now()}</code>`;
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
// DISCORD INTEGRATION
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
    footer: { text: `Royce Family · ID: ${data.id || 'N/A'}` },
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
 * @returns {Promise<boolean>} - true if at least one notification sent
 */
async function sendApplicationNotification(data) {
  console.log('📤 Sending application notification...', data);
  
  const results = await Promise.allSettled([
    postDiscordEmbed(buildDiscordApplicationEmbed(data)),
    sendTelegramMessage(formatTelegramApplication(data))
  ]);

  const discordOk = results[0].status === 'fulfilled' && results[0].value;
  const telegramOk = results[1].status === 'fulfilled' && results[1].value;

  console.log(`Discord: ${discordOk ? '✅' : '❌'}, Telegram: ${telegramOk ? '✅' : '❌'}`);

  // Return true if at least one notification was sent
  return discordOk || telegramOk;
}

/**
 * Send status update notification to Discord and Telegram
 * @param {Object} data - Application data
 * @param {string} status - 'accepted' or 'rejected'
 * @param {string|null} rejectReason - Rejection reason (if rejected)
 * @returns {Promise<boolean>}
 */
async function sendStatusNotification(data, status, rejectReason = null) {
  const results = await Promise.allSettled([
    postDiscordEmbed(buildDiscordStatusEmbed(data, status, rejectReason)),
    sendTelegramMessage(formatTelegramStatusUpdate(data, status, rejectReason))
  ]);

  const discordOk = results[0].status === 'fulfilled' && results[0].value;
  const telegramOk = results[1].status === 'fulfilled' && results[1].value;

  return discordOk || telegramOk;
}

// =====================================================
// LEGACY SUPPORT - for apply.html compatibility
// =====================================================

/**
 * Legacy function name for backward compatibility
 * @param {Object} data - Application data
 * @returns {Promise<boolean>}
 */
async function sendToDiscord(data) {
  return sendApplicationNotification(data);
}

// =====================================================
// EXPORTS (for use in other files)
// =====================================================

// For browser (attach to window)
if (typeof window !== 'undefined') {
  // New API
  window.RoyceWebhook = {
    sendApplicationNotification,
    sendStatusNotification,
    sendTelegramMessage,
    postDiscordEmbed
  };
  
  // Legacy support - direct function on window for apply.html
  window.sendToDiscord = sendToDiscord;
  window.sendApplicationNotification = sendApplicationNotification;
  window.sendStatusNotification = sendStatusNotification;
}

// For Node.js modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendApplicationNotification,
    sendStatusNotification,
    sendTelegramMessage,
    postDiscordEmbed,
    sendToDiscord,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID
  };
}
