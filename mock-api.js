const STATS_CACHE_KEY = 'media_stats';
const LAST_UPDATE_KEY = 'stats_last_update';

const BASE_STATS = {
  loves65: { tw: 12400, yt: 8500 },
  karapyzz: { tw: 28300, yt: 15000 },
  daszook: { tw: 7200, yt: 4100 },
  scrooge: { yt: 23000 },
  vuitton: { tw: 18600, yt: 9100 },
  escamismed: { tw: 9400 }
};

function jitter(value) {
  const sign = Math.random() < 0.5 ? 1 : -1;
  const percent = 0.05 + Math.random() * 0.03;
  return Math.max(1, Math.floor(value * (1 + sign * percent)));
}

function generateStats() {
  const result = {};
  for (const key in BASE_STATS) {
    const base = BASE_STATS[key];
    result[key] = {
      tw: base.tw ? jitter(base.tw) : null,
      yt: base.yt ? jitter(base.yt) : null
    };
  }
  localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(result));
  localStorage.setItem(LAST_UPDATE_KEY, String(Date.now()));
  return result;
}

function getStats() {
  const cached = localStorage.getItem(STATS_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn('Не удалось прочитать кэш статистики', error);
    }
  }
  return generateStats();
}

window.fetchMediaStats = async function fetchMediaStats() {
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  return getStats();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem(STATS_CACHE_KEY)) generateStats();
  });
} else if (!localStorage.getItem(STATS_CACHE_KEY)) {
  generateStats();
}
