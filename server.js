const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SOURCES_PATH = path.join(ROOT, 'media-sources.json');
const CACHE_TTL_MS = Number(process.env.MEDIA_CACHE_TTL_MS || 5 * 60 * 1000); // 5 minutes

// ==============================================
// API CREDENTIALS (set in environment variables)
// ==============================================
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyC2bUOQd5qI9ZCoSPAPdDcNayRQNZLdXZ4';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'uscbs7fbunzxslk60hsa314ff864k9';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || 'njlvo8z396vvxcp7adoosot3o120iw';

// ==============================================
// CACHE
// ==============================================
const cache = new Map();
const twitchTokenCache = {
  value: null,
  expiresAt: 0
};

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(express.json({ limit: '1mb' }));
app.use(express.static(ROOT));

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

async function readSources() {
  try {
    const data = await fs.readFile(SOURCES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading media-sources.json:', error);
    return [];
  }
}

function extractYouTubeHandle(url) {
  if (!url) return null;
  // Handle formats: /@handle, /channel/ID, /c/name, /user/name
  const patterns = [
    /youtube\.com\/@([^\/\?]+)/,
    /youtube\.com\/channel\/([^\/\?]+)/,
    /youtube\.com\/c\/([^\/\?]+)/,
    /youtube\.com\/user\/([^\/\?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractTwitchLogin(url) {
  if (!url) return null;
  const match = url.match(/twitch\.tv\/([^\/\?]+)/);
  return match ? match[1].toLowerCase() : null;
}

// ==============================================
// TWITCH API
// ==============================================

async function getTwitchAppAccessToken() {
  // Check cache
  if (twitchTokenCache.value && Date.now() < twitchTokenCache.expiresAt - 60000) {
    return twitchTokenCache.value;
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`Twitch token error: ${response.status}`);
    }

    const data = await response.json();
    twitchTokenCache.value = data.access_token;
    twitchTokenCache.expiresAt = Date.now() + (data.expires_in * 1000);
    
    console.log('✅ Twitch access token obtained');
    return data.access_token;
  } catch (error) {
    console.error('❌ Failed to get Twitch token:', error);
    return null;
  }
}

async function getTwitchUserData(login) {
  const cacheKey = `twitch:${login}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const token = await getTwitchAppAccessToken();
    if (!token) return null;

    // Get user info
    const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Twitch user error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    if (!userData.data || userData.data.length === 0) {
      return null;
    }

    const user = userData.data[0];
    const userId = user.id;

    // Get follower count
    const followerResponse = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${userId}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });

    let followers = 0;
    if (followerResponse.ok) {
      const followerData = await followerResponse.json();
      followers = followerData.total || 0;
    }

    const result = {
      id: userId,
      login: user.login,
      displayName: user.display_name,
      avatar: user.profile_image_url,
      followers: followers
    };

    // Cache result
    cache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    console.log(`✅ Twitch data for ${login}: ${followers} followers`);
    return result;
  } catch (error) {
    console.error(`❌ Twitch error for ${login}:`, error);
    return null;
  }
}

// ==============================================
// YOUTUBE API
// ==============================================

async function getYouTubeChannelData(handle) {
  const cacheKey = `youtube:${handle}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    // Try different search strategies
    let channelId = null;
    let channelData = null;

    // If it looks like a channel ID (starts with UC)
    if (handle.startsWith('UC')) {
      channelId = handle;
    } else {
      // Search for channel by handle/username
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${YOUTUBE_API_KEY}`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
          channelId = searchData.items[0].snippet.channelId;
        }
      }

      // Also try forHandle (for @username format)
      if (!channelId && handle.startsWith('@')) {
        const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${handle.substring(1)}&key=${YOUTUBE_API_KEY}`;
        const handleResponse = await fetch(handleUrl);
        if (handleResponse.ok) {
          const handleData = await handleResponse.json();
          if (handleData.items && handleData.items.length > 0) {
            channelData = handleData.items[0];
          }
        }
      }
    }

    // Get channel details if we have channelId but no data yet
    if (channelId && !channelData) {
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;
      const channelResponse = await fetch(channelUrl);
      
      if (channelResponse.ok) {
        const data = await channelResponse.json();
        if (data.items && data.items.length > 0) {
          channelData = data.items[0];
        }
      }
    }

    // Try forUsername as fallback
    if (!channelData) {
      const usernameUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forUsername=${handle}&key=${YOUTUBE_API_KEY}`;
      const usernameResponse = await fetch(usernameUrl);
      
      if (usernameResponse.ok) {
        const usernameData = await usernameResponse.json();
        if (usernameData.items && usernameData.items.length > 0) {
          channelData = usernameData.items[0];
        }
      }
    }

    if (!channelData) {
      console.log(`⚠️ YouTube channel not found: ${handle}`);
      return null;
    }

    const result = {
      id: channelData.id,
      title: channelData.snippet.title,
      avatar: channelData.snippet.thumbnails.default?.url || channelData.snippet.thumbnails.medium?.url,
      subscribers: parseInt(channelData.statistics.subscriberCount) || 0,
      hiddenSubscribers: channelData.statistics.hiddenSubscriberCount || false
    };

    // Cache result
    cache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    console.log(`✅ YouTube data for ${handle}: ${result.subscribers} subscribers`);
    return result;
  } catch (error) {
    console.error(`❌ YouTube error for ${handle}:`, error);
    return null;
  }
}

// ==============================================
// COMBINED MEDIA ITEM RESOLVER
// ==============================================

async function getLiveMediaItem(source) {
  const youtubeHandle = extractYouTubeHandle(source.youtube);
  const twitchLogin = extractTwitchLogin(source.twitch);

  // Fetch data in parallel
  const [youtubeData, twitchData] = await Promise.all([
    youtubeHandle ? getYouTubeChannelData(youtubeHandle) : null,
    twitchLogin ? getTwitchUserData(twitchLogin) : null
  ]);

  // Determine avatar based on preference
  let avatar = null;
  if (source.avatarPreference === 'youtube' && youtubeData?.avatar) {
    avatar = youtubeData.avatar;
  } else if (source.avatarPreference === 'twitch' && twitchData?.avatar) {
    avatar = twitchData.avatar;
  } else {
    // Fallback: use whichever is available
    avatar = twitchData?.avatar || youtubeData?.avatar || null;
  }

  return {
    name: source.name,
    description: source.description,
    avatar: avatar,
    youtube: source.youtube || null,
    twitch: source.twitch || null,
    stats: {
      youtubeSubscribers: youtubeData?.subscribers || null,
      twitchFollowers: twitchData?.followers || null
    },
    displayName: {
      youtube: youtubeData?.title || null,
      twitch: twitchData?.displayName || null
    }
  };
}

// ==============================================
// API ENDPOINTS
// ==============================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ 
    ok: true, 
    service: 'royce-media-api',
    cache_size: cache.size,
    twitch_token_valid: twitchTokenCache.value !== null && Date.now() < twitchTokenCache.expiresAt
  });
});

// Get live media data for all sources
app.get('/api/media/live', async (_req, res) => {
  try {
    const sources = await readSources();
    const items = await Promise.all(sources.map(getLiveMediaItem));
    
    res.json({ 
      ok: true, 
      updatedAt: Date.now(), 
      items 
    });
  } catch (error) {
    console.error('❌ /api/media/live error:', error);
    res.status(500).json({ 
      ok: false, 
      message: error.message || 'Failed to fetch media data' 
    });
  }
});

// Resolve single YouTube channel
app.get('/api/youtube/channel', async (req, res) => {
  const { url, handle } = req.query;
  const channelHandle = handle || extractYouTubeHandle(url);
  
  if (!channelHandle) {
    return res.status(400).json({ ok: false, message: 'Missing url or handle parameter' });
  }

  try {
    const data = await getYouTubeChannelData(channelHandle);
    if (!data) {
      return res.status(404).json({ ok: false, message: 'Channel not found' });
    }
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Resolve single Twitch channel
app.get('/api/twitch/channel', async (req, res) => {
  const { url, login } = req.query;
  const twitchLogin = login || extractTwitchLogin(url);
  
  if (!twitchLogin) {
    return res.status(400).json({ ok: false, message: 'Missing url or login parameter' });
  }

  try {
    const data = await getTwitchUserData(twitchLogin);
    if (!data) {
      return res.status(404).json({ ok: false, message: 'Channel not found' });
    }
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Resolve custom sources (POST)
app.post('/api/media/resolve', async (req, res) => {
  try {
    const { sources, mode = 'custom' } = req.body;
    
    let sourceList;
    if (mode === 'file') {
      sourceList = await readSources();
    } else if (Array.isArray(sources)) {
      sourceList = sources;
    } else {
      return res.status(400).json({ ok: false, message: 'Invalid sources' });
    }

    const items = await Promise.all(sourceList.map(getLiveMediaItem));
    
    res.json({ 
      ok: true, 
      updatedAt: Date.now(), 
      items 
    });
  } catch (error) {
    console.error('❌ /api/media/resolve error:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Clear cache (admin endpoint)
app.post('/api/cache/clear', (_req, res) => {
  cache.clear();
  twitchTokenCache.value = null;
  twitchTokenCache.expiresAt = 0;
  console.log('🗑️ Cache cleared');
  res.json({ ok: true, message: 'Cache cleared' });
});

// Fallback: serve static files or index.html
app.get('*', async (req, res) => {
  const filePath = path.join(ROOT, req.path);
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.sendFile(path.join(ROOT, 'index.html'));
  }
});

// ==============================================
// START SERVER
// ==============================================
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     🏆 ROYCE FAMILY MEDIA SERVER 🏆       ║
╠═══════════════════════════════════════════╣
║  Server running on port ${PORT}              ║
║  YouTube API: ${YOUTUBE_API_KEY ? '✅ Configured' : '❌ Missing'}            ║
║  Twitch API:  ${TWITCH_CLIENT_ID ? '✅ Configured' : '❌ Missing'}            ║
╚═══════════════════════════════════════════╝
  `);
});
