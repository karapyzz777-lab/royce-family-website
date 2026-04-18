const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1495157365560053902/TgfSxctBsJWCbXSoYCCueQjaLfHZIraEGL5Jxxgahr6JOcqKZBDxS-9jjTOLCfDQBsMS';

function getExperienceLabel(value) {
  const map = {
    newbie: 'Новичок (меньше месяца)',
    intermediate: 'Есть опыт (1–6 месяцев)',
    experienced: 'Опытный игрок (6+ месяцев)',
    veteran: 'Ветеран RP'
  };
  return map[value] || value || '—';
}

async function postEmbed(embed) {
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
    return true;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Discord webhook fetch failed:', error);
    return false;
  }
}

window.sendToDiscord = async function sendToDiscord(application) {
  const embed = {
    title: '📄 Новая заявка — ROYCE FAMILY',
    color: 0xc9a85d,
    timestamp: new Date().toISOString(),
    footer: { text: 'ROYCE FAMILY — Система заявок' },
    fields: [
      { name: '🎮 Никнейм', value: application.nickname || '—', inline: true },
      { name: '💬 Discord', value: application.discord || '—', inline: true },
      { name: '🎂 Возраст', value: String(application.age || '—'), inline: true },
      { name: '🕐 Часовой пояс', value: application.timezone || '—', inline: true },
      { name: '⭐ Опыт', value: getExperienceLabel(application.experience), inline: false },
      { name: '📝 Причина вступления', value: application.reason || '—', inline: false }
    ]
  };

  return postEmbed(embed);
};

window.sendApprovalNotification = async function sendApprovalNotification(discordTag, nickname) {
  const embed = {
    title: '✅ Заявка одобрена — ROYCE FAMILY',
    color: 0x37c6a0,
    description: `Пользователь **${nickname}** был принят в семью.\n\nDiscord: **${discordTag}**`,
    timestamp: new Date().toISOString(),
    footer: { text: 'ROYCE FAMILY — Система заявок' }
  };
  return postEmbed(embed);
};

window.sendRejectionNotification = async function sendRejectionNotification(discordTag, reason) {
  const embed = {
    title: '❌ Заявка отклонена — ROYCE FAMILY',
    color: 0xff6f6f,
    description: `Discord: **${discordTag}**\nПричина: **${reason}**`,
    timestamp: new Date().toISOString(),
    footer: { text: 'ROYCE FAMILY — Система заявок' }
  };
  return postEmbed(embed);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendToDiscord: window.sendToDiscord,
    sendApprovalNotification: window.sendApprovalNotification,
    sendRejectionNotification: window.sendRejectionNotification
  };
}
