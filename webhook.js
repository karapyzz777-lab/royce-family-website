// Discord Webhook — отправка заявок на сервер
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1495157365560053902/TgfSxctBsJWCbXSoYCCueQjaLfHZIraEGL5Jxxgahr6JOcqKZBDxS-9jjTOLCfDQBsMS';

/**
 * Отправляет заявку в Discord через webhook
 */
async function sendToDiscord(application) {
  if (!DISCORD_WEBHOOK) {
    console.warn('Discord webhook URL не задан');
    return false;
  }

  const embed = {
    title: '📄 Новая заявка — ROYCE FAMILY',
    color: 0x00ff9f,
    timestamp: new Date().toISOString(),
    footer: { text: 'ROYCE FAMILY — Система заявок' },
    fields: [
      { name: '🎮 Никнейм (IGN)', value: application.nickname || '—', inline: true },
      { name: '💬 Discord', value: application.discord || '—', inline: true },
      { name: '🎂 Возраст', value: String(application.age || '—'), inline: true },
      { name: '🕐 Часовой пояс', value: application.timezone || '—', inline: true },
      { name: '⭐ Опыт в GTA 5 RP', value: getExperienceLabel(application.experience) || '—', inline: false },
      { name: '📝 Причина вступления', value: application.reason || '—', inline: false }
    ]
  };

  return await postEmbed(embed);
}

/**
 * Отправляет уведомление об одобрении заявки
 */
async function sendApprovalNotification(discordTag, nickname) {
  if (!DISCORD_WEBHOOK) return false;

  const embed = {
    title: '✅ Заявка одобрена — ROYCE FAMILY',
    color: 0x00ff9f,
    description: `Пользователь **${nickname}** был принят в семью!\n\n** discord:** ${discordTag}\n** Ссылка на сервер:** https://discord.gg/royce`,
    timestamp: new Date().toISOString(),
    footer: { text: 'ROYCE FAMILY — Система заявок' }
  };

  return await postEmbed(embed);
}

/**
 * Отправляет уведомление об отклонении заявки
 */
async function sendRejectionNotification(discordTag, reason) {
  if (!DISCORD_WEBHOOK) return false;

  const embed = {
    title: '❌ Заявка отклонена — ROYCE FAMILY',
    color: 0xff3a3a,
    description: `К сожалению, ваша заявка была отклонена.\n\n**Причина:** ${reason}\n\nВы можете подать заявку повторно через некоторое время.`,
    timestamp: new Date().toISOString(),
    footer: { text: 'ROYCE FAMILY — Система заявок' }
  };

  return await postEmbed(embed);
}

/**
 * Универсальный метод отправки embed в Discord
 */
async function postEmbed(embed) {
  const payload = { embeds: [embed] };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Discord webhook error:', response.status, response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Discord webhook timeout (10s)');
    } else {
      console.error('Discord webhook fetch failed:', error);
    }
    return false;
  }
}

// Хелперы
function getExperienceLabel(val) {
  const map = {
    'newbie': 'Новичок (меньше месяца)',
    'intermediate': 'Есть опыт (1-6 месяцев)',
    'experienced': 'Опытный игрок (6+ месяцев)',
    'veteran': 'Ветеран RP'
  };
  return map[val] || val;
}

// Экспорт для Node.js (если needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendToDiscord, sendApprovalNotification, sendRejectionNotification };
}

  const embed = {
    title: '📄 Новая заявка — ROYCE FAMILY',
    color: 0x00ff9f,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'ROYCE FAMILY — Система заявок',
      icon_url: 'https://cdn.discordapp.com/emojis/...' // опционально
    },
    fields: [
      { name: '🎮 Никнейм (IGN)', value: application.ign || '—', inline: true },
      { name: '💬 Discord', value: application.discord || '—', inline: true },
      { name: '🎂 Возраст', value: String(application.age || '—'), inline: true },
      { name: '🕐 Часовой пояс', value: application.timezone || '—', inline: true },
      { name: '⭐ Опыт в GTA 5 RP', value: application.experience || '—', inline: false },
      { name: '📝 Причина вступления', value: application.motivation || '—', inline: false }
    ]
  };

  const payload = { embeds: [embed] };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 сек таймаут

    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Discord webhook error:', response.status, response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Discord webhook timeout (10s)');
    } else {
      console.error('Discord webhook fetch failed:', error);
    }
    return false;
  }
}

// Экспорт для use в других модулях (если needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendToDiscord };
}
