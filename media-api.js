// ==============================================
// ROYCE FAMILY - MEDIA API CLIENT
// Fetches live data from server API
// ==============================================

const MediaAPI = {
  // Base URL for API (auto-detect)
  baseUrl: '',

  // Cache for client-side
  cache: null,
  cacheExpiry: 0,
  CACHE_TTL: 60 * 1000, // 1 minute client cache

  /**
   * Fetch live media data from server
   * @returns {Promise<Array>} Array of media items with stats
   */
  async fetchLiveMedia() {
    // Check client cache first
    if (this.cache && Date.now() < this.cacheExpiry) {
      console.log('📦 Using cached media data');
      return this.cache;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/media/live`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.message || 'Unknown error');
      }

      // Update cache
      this.cache = data.items;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      console.log(`✅ Loaded ${data.items.length} media sources`);
      return data.items;
    } catch (error) {
      console.error('❌ Failed to fetch media:', error);
      
      // Return cached data if available
      if (this.cache) {
        console.log('📦 Returning stale cache');
        return this.cache;
      }
      
      return [];
    }
  },

  /**
   * Resolve a single YouTube channel
   * @param {string} url - YouTube channel URL
   * @returns {Promise<Object|null>}
   */
  async resolveYouTube(url) {
    try {
      const response = await fetch(`${this.baseUrl}/api/youtube/channel?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      return data.ok ? data.data : null;
    } catch (error) {
      console.error('YouTube resolve error:', error);
      return null;
    }
  },

  /**
   * Resolve a single Twitch channel
   * @param {string} url - Twitch channel URL
   * @returns {Promise<Object|null>}
   */
  async resolveTwitch(url) {
    try {
      const response = await fetch(`${this.baseUrl}/api/twitch/channel?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      return data.ok ? data.data : null;
    } catch (error) {
      console.error('Twitch resolve error:', error);
      return null;
    }
  },

  /**
   * Format subscriber/follower count for display
   * @param {number} count 
   * @returns {string}
   */
  formatCount(count) {
    if (count === null || count === undefined) return '—';
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return count.toLocaleString('ru-RU');
  },

  /**
   * Clear client cache and optionally server cache
   * @param {boolean} clearServer - Also clear server cache
   */
  async clearCache(clearServer = false) {
    this.cache = null;
    this.cacheExpiry = 0;
    console.log('🗑️ Client cache cleared');

    if (clearServer) {
      try {
        await fetch(`${this.baseUrl}/api/cache/clear`, { method: 'POST' });
        console.log('🗑️ Server cache cleared');
      } catch (error) {
        console.error('Failed to clear server cache:', error);
      }
    }
  }
};

// ==============================================
// MEDIA CARDS RENDERER
// ==============================================

const MediaRenderer = {
  /**
   * Render all media cards to container
   * @param {string} containerId - ID of container element
   */
  async renderCards(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    // Show loading state
    container.innerHTML = '<div class="media-loading">Загрузка медиа...</div>';

    try {
      const items = await MediaAPI.fetchLiveMedia();
      
      if (items.length === 0) {
        container.innerHTML = '<div class="media-empty">Нет медиа-партнёров</div>';
        return;
      }

      container.innerHTML = items.map(item => this.createCardHTML(item)).join('');
      
      // Add animation
      container.querySelectorAll('.media-card').forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in');
      });
    } catch (error) {
      container.innerHTML = '<div class="media-error">Ошибка загрузки медиа</div>';
    }
  },

  /**
   * Create HTML for a single media card
   * @param {Object} item - Media item data
   * @returns {string} HTML string
   */
  createCardHTML(item) {
    const avatar = item.avatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23fff" font-size="40">' + (item.name?.[0] || '?') + '</text></svg>';
    
    const badges = [];
    if (item.twitch) badges.push('<span class="badge badge-twitch">Twitch</span>');
    if (item.youtube) badges.push('<span class="badge badge-youtube">YouTube</span>');

    const stats = [];
    if (item.stats.youtubeSubscribers !== null) {
      stats.push(`<span class="stat stat-youtube">${MediaAPI.formatCount(item.stats.youtubeSubscribers)} подписчиков</span>`);
    }
    if (item.stats.twitchFollowers !== null) {
      stats.push(`<span class="stat stat-twitch">${MediaAPI.formatCount(item.stats.twitchFollowers)} фолловеров</span>`);
    }

    const links = [];
    if (item.twitch) links.push(`<a href="${item.twitch}" target="_blank" rel="noopener" class="media-link twitch-link">Twitch</a>`);
    if (item.youtube) links.push(`<a href="${item.youtube}" target="_blank" rel="noopener" class="media-link youtube-link">YouTube</a>`);

    return `
      <div class="media-card">
        <div class="media-card-header">
          <img src="${avatar}" alt="${item.name}" class="media-avatar" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/></svg>'">
          <div class="media-info">
            <h3 class="media-name">${item.name}</h3>
            <p class="media-description">${item.description || ''}</p>
          </div>
        </div>
        <div class="media-badges">${badges.join('')}</div>
        <div class="media-stats">${stats.join('')}</div>
        <div class="media-links">
          <button class="btn btn-secondary" onclick="this.nextElementSibling.classList.toggle('show')">Открыть ссылки</button>
          <div class="media-links-dropdown">${links.join('')}</div>
        </div>
      </div>
    `;
  },

  /**
   * Refresh media cards
   * @param {string} containerId 
   * @param {boolean} clearCache 
   */
  async refresh(containerId, clearCache = true) {
    if (clearCache) {
      await MediaAPI.clearCache();
    }
    await this.renderCards(containerId);
  }
};

// ==============================================
// AUTO-REFRESH (optional)
// ==============================================

let autoRefreshInterval = null;

function startAutoRefresh(containerId, intervalMs = 5 * 60 * 1000) {
  stopAutoRefresh();
  autoRefreshInterval = setInterval(() => {
    console.log('🔄 Auto-refreshing media data...');
    MediaRenderer.refresh(containerId, true);
  }, intervalMs);
  console.log(`⏰ Auto-refresh started (every ${intervalMs / 1000}s)`);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    console.log('⏹️ Auto-refresh stopped');
  }
}

// ==============================================
// EXPORTS
// ==============================================

if (typeof window !== 'undefined') {
  window.MediaAPI = MediaAPI;
  window.MediaRenderer = MediaRenderer;
  window.startAutoRefresh = startAutoRefresh;
  window.stopAutoRefresh = stopAutoRefresh;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MediaAPI, MediaRenderer, startAutoRefresh, stopAutoRefresh };
}
