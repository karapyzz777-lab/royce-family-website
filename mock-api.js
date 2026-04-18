// Mock API — имитация backend-ova medias з часовыми поясами (UTC+3..UTC+11)
// Используется для автообновления статистики в режиме реального времени
// Данные кэшируются в localStorage, чтобы не делать запросы каждые 5 сек

const STATS_CACHE_KEY = 'media_stats';
const LAST_UPDATE_KEY = 'stats_last_update';

// Базовые значения (инициализируют localStorage при первом запуске)
const BASE_STATS = {
  loves65: { tw: 12400, yt: 8500 },
  karapyzz: { tw: 28300, yt: 15000 },
  daszook: { tw: 7200, yt: 4100 },
  scrooge: { yt: 23000 },
  vuitton: { tw: 18600, yt: 9100 },
  escamismed: { tw: 9400 }
};

// Рандом ±5–8% чтобы имитировать живой рост/падение
function jitter(val) {
  const sign = Math.random() < 0.5 ? 1 : -1;
  const pct = 0.05 + Math.random() * 0.03;
  return Math.max(1, Math.floor(val * (1 + sign * pct)));
}

// Генерация новых cached-данных
function generateStats() {
  const stats = {};
  for (const id in BASE_STATS) {
    const base = BASE_STATS[id];
    stats[id] = {
      tw: base.tw ? jitter(base.tw) : null,
      yt: base.yt ? jitter(base.yt) : null
    };
  }
  localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(stats));
  localStorage.setItem(LAST_UPDATE_KEY, Date.now().toString());
  return stats;
}

// Получение stats с fallback на cached и then на базовые
function getStats() {
  const cached = localStorage.getItem(STATS_CACHE_KEY);
  if (cached) try { return JSON.parse(cached); } catch (_) {}
  return generateStats(); // warm-up при первом запуске
}

// API-метод — вызывается каждые 5 сек из index.html
window.fetchMediaStats = async function() {
  // Имитация сетевой задержки 300–800 мс
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
  return getStats();
};

// Warm-up cache при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem(STATS_CACHE_KEY)) generateStats();
  });
} else {
  if (!localStorage.getItem(STATS_CACHE_KEY)) generateStats();
}
