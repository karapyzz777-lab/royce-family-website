const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SOURCES_PATH = path.join(ROOT, 'media-sources.json');
const CACHE_TTL_MS = Number(process.env.MEDIA_CACHE_TTL_MS || 5 * 60 * 1000);

const cache = new Map();
const twitchTokenCache = {
  value: null,
  expiresAt: 0
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(ROOT));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'royce-media-api' });
});

app.get('/api/media/live', async (_req, res) => {
  try {
    const sources = await readSources();
    const items = await Promise.all(sources.map(getLiveMediaItem));
    res.json({ ok: true, updatedAt: Date.now(), items });
  } catch (error) {
    console.error('media/live error:', error);
    res.status(500).json({ ok: false, message: error.message || 'Не удалось загрузить медиа-данные' });
  }
});

app.post('/api/media/resolve', async (req, res) => {
  try {
    const sources = Array.isArray(req.body?.sources) && req.body.sources.length
      ? sanitizeSources(req.body.sources)
      : await readSources();

    const items = await Promise.all(sources.map(getLiveMediaItem));
    res.json({
      ok: true,
      updatedAt: Date.now(),
      sourceMode: Array.isArray(req.body?.sources) && req.body.sources.length ? 'custom' : 'file',
      items
    });
  } catch (error) {
    console.error('media/resolve error:', error);
    res.status(500).json({ ok: false, message: error.message || 'Не удалось обработать медиа-источники' });
  }
});

app.get('*', (req, res) => {
  const requested = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '');
  res.sendFile(path.join(ROOT, requested), (error) => {
    if (error) res.sendFile(path.join(ROOT, 'index.html'));
  });
});

app.listen(PORT, () => {
  console.log(`Royce Family server started on http://localhost:${PORT}`);
});

async function readSources() {
  const raw = await fs.readFile(SOURCES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('media-sources.json должен содержать массив объектов');
  }
  return sanitizeSources(parsed);
}

function sanitizeSources(input) {
  return input
    .filter(Boolean)
    .map((item) => ({
      name: String(item.name || '').trim(),
      description: String(item.description || '').trim(),
      youtube: String(item.youtube || '').trim(),
      twitch: String(item.twitch || '').trim(),
      avatar: String(item.avatar || '').trim(),
      avatarPreference: item.avatarPreference === 'youtube' ? 'youtube' : 'twitch'
    }))
    .filter((item) => item.name || item.youtube || item.twitch);
}

async function getLiveMediaItem(source) {
  const cacheKey = JSON.stringify(source);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const warnings = [];
  const result = {
    id: slugify(source.name || source.youtube || source.twitch || Math.random().toString(36).slice(2)),
    name: source.name || 'Без названия',
    description: source.description || 'Медиа-участник Royce Family',
    youtube: source.youtube || '',
    twitch: source.twitch || '',
    avatar: source.avatar || '',
    avatarSource: source.avatar ? 'manual' : '',
    stats: {
      youtubeSubscribers: null,
      twitchFollowers: null
    },
    lastResolvedAt: Date.now(),
    warnings
  };

  if (result.youtube) {
    try {
      const yt = await resolveYouTube(result.youtube);
      if (yt.name && !source.name) result.name = yt.name;
      if (yt.avatar && (!result.avatar || source.avatarPreference === 'youtube')) {
        result.avatar = yt.avatar;
        result.avatarSource = 'youtube';
      }
      if (typeof yt.subscribers === 'number') {
        result.stats.youtubeSubscribers = yt.subscribers;
      }
    } catch (error) {
      warnings.push(`YouTube: ${error.message}`);
    }
  }

  if (result.twitch) {
    try {
      const tw = await resolveTwitch(result.twitch);
      if (tw.name && !source.name) result.name = tw.name;
      if (tw.avatar && (!result.avatar || source.avatarPreference === 'twitch' || !result.youtube)) {
        result.avatar = tw.avatar;
        result.avatarSource = 'twitch';
      }
      if (typeof tw.followers === 'number') {
        result.stats.twitchFollowers = tw.followers;
      }
      if (tw.warning) warnings.push(tw.warning);
    } catch (error) {
      warnings.push(`Twitch: ${error.message}`);
    }
  }

  if (!result.avatar) {
    result.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name.charAt(0) || 'R')}&background=11151d&color=E7D6A8`;
    result.avatarSource = 'fallback';
  }

  cache.set(cacheKey, {
    value: result,
    expiresAt: Date.now() + CACHE_TTL_MS
  });

  return result;
}

async function resolveYouTube(inputUrl) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('не задан YOUTUBE_API_KEY в .env');
  }

  const filter = extractYouTubeFilter(inputUrl);
  if (!filter) {
    throw new Error('используй YouTube ссылку формата @handle, /channel/ID или /user/username');
  }

  const params = new URLSearchParams({
    part: 'snippet,statistics',
    key: apiKey,
    [filter.key]: filter.value
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ответил ${response.status}: ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  const item = data.items?.[0];
  if (!item) {
    throw new Error('канал не найден');
  }

  return {
    name: item.snippet?.title || null,
    avatar: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
    subscribers: Number(item.statistics?.subscriberCount || 0)
  };
}

function extractYouTubeFilter(input) {
  try {
    const url = new URL(normalizeUrl(input));
    const cleanPath = url.pathname.replace(/\/+$/, '');

    if (cleanPath.startsWith('/@')) {
      return { key: 'forHandle', value: cleanPath.slice(2) };
    }

    if (cleanPath.startsWith('/channel/')) {
      return { key: 'id', value: cleanPath.split('/')[2] };
    }

    if (cleanPath.startsWith('/user/')) {
      return { key: 'forUsername', value: cleanPath.split('/')[2] };
    }

    if (/^UC[\w-]{20,}$/.test(input.trim())) {
      return { key: 'id', value: input.trim() };
    }

    if (/^@?[A-Za-z0-9._-]+$/.test(input.trim())) {
      return { key: 'forHandle', value: input.trim().replace(/^@/, '') };
    }
  } catch (_error) {
    if (/^UC[\w-]{20,}$/.test(input.trim())) {
      return { key: 'id', value: input.trim() };
    }
  }
  return null;
}

async function resolveTwitch(inputUrl) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error('не задан TWITCH_CLIENT_ID в .env');
  }

  const login = extractTwitchLogin(inputUrl);
  if (!login) {
    throw new Error('используй Twitch ссылку формата twitch.tv/login');
  }

  const appToken = await getTwitchAppAccessToken();
  const user = await twitchGet(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, appToken, clientId);
  const item = user.data?.[0];
  if (!item) {
    throw new Error('канал Twitch не найден');
  }

  let followers = null;
  let warning = '';
  const userToken = process.env.TWITCH_USER_ACCESS_TOKEN || appToken;

  try {
    const followersResponse = await twitchGet(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(item.id)}`, userToken, clientId);
    followers = typeof followersResponse.total === 'number' ? followersResponse.total : null;
  } catch (_error) {
    warning = 'для live фолловеров Twitch желательно добавить TWITCH_USER_ACCESS_TOKEN; аватар всё равно обновляется автоматически';
  }

  return {
    name: item.display_name || item.login || null,
    avatar: item.profile_image_url || null,
    followers,
    warning
  };
}

function extractTwitchLogin(input) {
  try {
    const url = new URL(normalizeUrl(input));
    const clean = url.pathname.replace(/^\//, '').replace(/\/+$/, '');
    if (!clean) return null;
    return clean.split('/')[0];
  } catch (_error) {
    return input.trim().replace(/^@/, '') || null;
  }
}

async function getTwitchAppAccessToken() {
  if (process.env.TWITCH_APP_ACCESS_TOKEN) {
    return process.env.TWITCH_APP_ACCESS_TOKEN;
  }

  if (twitchTokenCache.value && twitchTokenCache.expiresAt > Date.now()) {
    return twitchTokenCache.value;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('задай TWITCH_APP_ACCESS_TOKEN или пару TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`не удалось получить app token Twitch: ${response.status} ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  twitchTokenCache.value = data.access_token;
  twitchTokenCache.expiresAt = Date.now() + Math.max((Number(data.expires_in) - 60) * 1000, 60_000);
  return twitchTokenCache.value;
}

async function twitchGet(url, token, clientId) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': clientId
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twitch API ${response.status}: ${text.slice(0, 160)}`);
  }

  return response.json();
}

function normalizeUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'media-item';
}
