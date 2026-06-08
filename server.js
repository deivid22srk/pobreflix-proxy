const express = require('express');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing body on POST requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Target settings
const POBREFLIX_HOST = 'www.pobreflix.you';
const POBREFLIX_URL = `https://${POBREFLIX_HOST}`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Helper to make fetch requests with custom headers
async function fetchTarget(url, options = {}) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Referer': POBREFLIX_URL + '/',
    ...options.headers
  };
  return fetch(url, { ...options, headers });
}

// Scrape Homepage Data
app.get('/api/home', async (req, res) => {
  console.log('[API] Scraping homepage...');
  try {
    const response = await fetchTarget(POBREFLIX_URL);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const featured = [];
    const movies = [];
    const series = [];
    const seasons = [];

    // Helper to extract item properties
    const parseItem = (el) => {
      const title = $(el).find('.data h3 a').text().trim();
      const href = $(el).find('.data h3 a').attr('href') || '';
      const path = href.replace(POBREFLIX_URL, '');
      const img = $(el).find('.poster img').attr('src') || $(el).find('.poster img').attr('data-src') || '';
      const rating = $(el).find('.rating').text().trim();
      const year = $(el).find('.data span').text().trim();
      
      let type = 'movie';
      if (path.includes('/series/')) type = 'tv';
      else if (path.includes('/temporadas/')) type = 'season';
      else if (path.includes('/episodios/')) type = 'episode';

      return { title, path, img, rating, year, type };
    };

    // 1. Featured Releases
    $('.items.featured .item').each((i, el) => {
      featured.push(parseItem(el));
    });

    // 2. Latest Movies
    $('.items.normal').eq(0).find('.item').each((i, el) => {
      movies.push(parseItem(el));
    });

    // 3. Latest Series
    $('.items.normal').eq(1).find('.item').each((i, el) => {
      series.push(parseItem(el));
    });

    // 4. Latest Seasons
    $('.items.normal, .animation-2.items.normal').last().find('.item').each((i, el) => {
      seasons.push(parseItem(el));
    });

    res.json({ featured, movies, series, seasons });
  } catch (error) {
    console.error('[API] Error scraping homepage:', error);
    res.status(500).json({ error: 'Erro ao raspar a home page.' });
  }
});

// Search Endpoint
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Parâmetro de pesquisa ausente.' });
  console.log(`[API] Searching for: ${query}`);

  try {
    const searchUrl = `${POBREFLIX_URL}/?s=${encodeURIComponent(query)}`;
    const response = await fetchTarget(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results = [];
    $('.result-item').each((i, el) => {
      const title = $(el).find('.title a').text().trim();
      const href = $(el).find('.title a').attr('href') || '';
      const path = href.replace(POBREFLIX_URL, '');
      const img = $(el).find('.image img').attr('src') || $(el).find('.image img').attr('data-src') || '';
      const rating = $(el).find('.rating').text().trim().replace('IMDb ', '');
      const year = $(el).find('.meta span.year').text().trim() || $(el).find('.meta').text().trim();
      
      let type = 'movie';
      if (path.includes('/series/')) type = 'tv';
      else if (path.includes('/temporadas/')) type = 'season';
      else if (path.includes('/episodios/')) type = 'episode';

      results.push({ title, path, img, rating, year, type });
    });

    res.json(results);
  } catch (error) {
    console.error('[API] Error during search:', error);
    res.status(500).json({ error: 'Erro ao pesquisar conteúdo.' });
  }
});

// Scrape Details Endpoint (Movie / Series / Episode)
app.get('/api/details', async (req, res) => {
  const pathParam = req.query.path;
  if (!pathParam) return res.status(400).json({ error: 'Parâmetro de caminho ausente.' });
  console.log(`[API] Fetching details for path: ${pathParam}`);

  try {
    const targetUrl = `${POBREFLIX_URL}${pathParam}`;
    const response = await fetchTarget(targetUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    if (pathParam.includes('/filmes/')) {
      // --- Movie Parser ---
      const title = $('.sheader .data h1').text().trim();
      const poster = $('.poster img').attr('src') || $('.poster img').attr('data-src') || '';
      const description = $('.wp-content p').text().trim();
      const date = $('.sheader .data .extra span.date').text().trim();
      const country = $('.sheader .data .extra span.country').text().trim();
      const runtime = $('.sheader .data .extra span.runtime').text().trim();
      const rating = $('.dt_rating_vgs').text().trim() || $('.starstruck-rating span[itemprop="ratingValue"]').text().trim();
      
      const genres = [];
      $('.sgeneros a').each((i, el) => {
        genres.push($(el).text().trim());
      });

      const players = [];
      $('#playeroptionsul li').each((i, el) => {
        const pTitle = $(el).find('.title').text().trim();
        const type = $(el).attr('data-type');
        const post = $(el).attr('data-post');
        const nume = $(el).attr('data-nume');
        
        const iframeSrc = $(`#source-player-${nume} iframe`).attr('src') || '';
        
        players.push({ title: pTitle, type, post, nume, src: iframeSrc });
      });

      // Fetch dynamic players if not found statically (robust fallback)
      for (const p of players) {
        if (!p.src) {
          p.src = await getPlayerFallback(p.post, p.type, p.nume);
        }
      }

      return res.json({ type: 'movie', title, poster, description, date, country, runtime, rating, genres, players });

    } else if (pathParam.includes('/series/')) {
      // --- TV Series Parser ---
      const title = $('.sheader .data h1').text().trim();
      const poster = $('.poster img').attr('src') || $('.poster img').attr('data-src') || '';
      const description = $('.wp-content p').text().trim();
      const rating = $('.dt_rating_vgs').text().trim() || $('.starstruck-rating span[itemprop="ratingValue"]').text().trim();
      
      const genres = [];
      $('.sgeneros a').each((i, el) => {
        genres.push($(el).text().trim());
      });

      const seasons = [];
      $('#seasons .se-c').each((i, el) => {
        const seasonTitle = $(el).find('.title').text().trim();
        
        const episodes = [];
        $(el).find('.episodios li').each((j, epEl) => {
          const numerando = $(epEl).find('.numerando').text().trim();
          const epName = $(epEl).find('.episodiotitle a').text().trim();
          const href = $(epEl).find('.episodiotitle a').attr('href') || '';
          const path = href.replace(POBREFLIX_URL, '');
          const date = $(epEl).find('.date').text().trim();
          const img = $(epEl).find('.imagen img').attr('src') || $(epEl).find('.imagen img').attr('data-src') || '';
          
          episodes.push({ numerando, name: epName, path, date, img });
        });

        seasons.push({ title: seasonTitle, episodes });
      });

      return res.json({ type: 'series', title, poster, description, rating, genres, seasons });

    } else if (pathParam.includes('/episodios/')) {
      // --- Episode Parser ---
      const title = $('.epih1').text().trim();
      const subtitle = $('.epih3').text().trim();
      const description = $('div[itemprop="description"] p').text().trim() || $('.wp-content p').text().trim();
      const date = $('span.date').text().trim();
      const poster = $('.galeria .g-item img').attr('src') || $('.galeria .g-item img').attr('data-src') || '';

      const players = [];
      $('#playeroptionsul li').each((i, el) => {
        const pTitle = $(el).find('.title').text().trim();
        const type = $(el).attr('data-type');
        const post = $(el).attr('data-post');
        const nume = $(el).attr('data-nume');
        
        const iframeSrc = $(`#source-player-${nume} iframe`).attr('src') || '';
        
        players.push({ title: pTitle, type, post, nume, src: iframeSrc });
      });

      // Fetch dynamic players if not found statically (robust fallback)
      for (const p of players) {
        if (!p.src) {
          p.src = await getPlayerFallback(p.post, p.type, p.nume);
        }
      }

      return res.json({ type: 'episode', title, subtitle, description, date, poster, players });
    }

    res.status(404).json({ error: 'Tipo de conteúdo não suportado.' });
  } catch (error) {
    console.error('[API] Error scraping details:', error);
    res.status(500).json({ error: 'Erro ao raspar os detalhes do conteúdo.' });
  }
});

// Robust Fallback scraper for dynamic play options
async function getPlayerFallback(post, type, nume) {
  try {
    // Try wp_json first
    const apiRes = await fetch(`${POBREFLIX_URL}/wp-json/dooplayer/v2/${post}/${type}/${nume}`, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': POBREFLIX_URL + '/' }
    });
    if (apiRes.status === 200) {
      const data = await apiRes.json();
      if (data.embed_url || data.embed) return data.embed_url || data.embed;
    }
  } catch (err) {}

  try {
    // Try admin-ajax.php POST
    const formData = new URLSearchParams();
    formData.append('action', 'doo_player_ajax');
    formData.append('post', post);
    formData.append('nume', nume);
    formData.append('type', type);
    const ajaxRes = await fetch(`${POBREFLIX_URL}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': POBREFLIX_URL + '/'
      },
      body: formData
    });
    if (ajaxRes.status === 200) {
      const data = await ajaxRes.json();
      return data.embed_url || data.embed;
    }
  } catch (err) {}

  return '';
}

// -------------------------------------------------------------
// MASTER LEVEL PROXY ENGINEERING ROUTES (Bypass CSP, Referers & Cookies)
// -------------------------------------------------------------

// Helper to filter and clean headers before forwarding
function cleanRequestHeaders(headers, targetHost) {
  const cleaned = {};
  
  if (headers['cookie']) {
    cleaned['cookie'] = headers['cookie'];
  }
  if (headers['accept-language']) {
    cleaned['accept-language'] = headers['accept-language'];
  }
  if (headers['accept']) {
    cleaned['accept'] = headers['accept'];
  }
  if (headers['content-type']) {
    cleaned['content-type'] = headers['content-type'];
  }
  
  cleaned.host = targetHost;
  return cleaned;
}

function cleanResponseHeaders(res, targetHeaders) {
  targetHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey !== 'content-security-policy' &&
      lowerKey !== 'x-frame-options' &&
      lowerKey !== 'content-length' &&
      lowerKey !== 'transfer-encoding' &&
      lowerKey !== 'connection' &&
      lowerKey !== 'content-encoding'
    ) {
      res.setHeader(key, value);
    }
  });
  
  // Disable CSP, allow iframe embedding
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
}

// 1. Proxy Player HTML Page Route
app.get('/api/proxy-player', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || POBREFLIX_URL + '/';
  
  if (!targetUrl) return res.status(400).send('URL de destino ausente.');
  console.log(`[PROXY] Fetching player HTML: ${targetUrl}`);

  try {
    const parsedUrl = new URL(targetUrl);
    const targetHost = parsedUrl.host;

    // Clean headers, forward client cookies
    const headers = cleanRequestHeaders(req.headers, targetHost);
    headers['Referer'] = referer;
    headers['User-Agent'] = USER_AGENT;

    const response = await fetch(targetUrl, { headers });
    
    // Copy response cookies to client
    const setCookie = response.headers.getSetCookie();
    if (setCookie && setCookie.length > 0) {
      res.setHeader('Set-Cookie', setCookie);
    }

    cleanResponseHeaders(res, response.headers);
    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      // Rewrite Plenoflu relative resources & API calls
      html = html.replace(/https:\/\/plenoflu\.com/g, '/proxy-plenoflu');
      html = html.replace(/http:\/\/plenoflu\.com/g, '/proxy-plenoflu');
      // For plenoflu's AJAX HOME_URL definition
      html = html.replace(/HOME_URL\s*=\s*['"`]https:\/\/plenoflu\.com['"`]/g, "HOME_URL = '/proxy-plenoflu'");
      
      // Rewrite Linktudi relative resources & script player_base_url calls
      html = html.replace(/https:\/\/linktudi\.com/g, '/proxy-linktudi');
      html = html.replace(/http:\/\/linktudi\.com/g, '/proxy-linktudi');
      html = html.replace(/player_base_url\s*=\s*['"`]https:\/\/linktudi\.com['"`]/g, "player_base_url = '/proxy-linktudi'");

      res.send(html);
    } else {
      // Pipe non-HTML responses directly
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    }
  } catch (error) {
    console.error('[PROXY] Error proxying player:', error);
    res.status(500).send('Erro ao carregar o player.');
  }
});

// 2. Proxy Route for Plenoflu requests
app.all('/proxy-plenoflu/*', async (req, res) => {
  const relativePath = req.url.replace('/proxy-plenoflu', '');
  const targetUrl = `https://plenoflu.com${relativePath}`;
  console.log(`[PROXY-PLENOFLU] Forwarding: ${req.method} ${req.url} -> ${targetUrl}`);

  try {
    const headers = cleanRequestHeaders(req.headers, 'plenoflu.com');
    headers['Referer'] = 'https://plenoflu.com/';
    headers['Origin'] = 'https://plenoflu.com';
    headers['User-Agent'] = USER_AGENT;

    const fetchOptions = {
      method: req.method,
      headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.headers['content-type']?.includes('application/json')) {
        fetchOptions.body = JSON.stringify(req.body);
      } else {
        fetchOptions.body = new URLSearchParams(req.body).toString();
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward cookies
    const setCookie = response.headers.getSetCookie();
    if (setCookie && setCookie.length > 0) {
      res.setHeader('Set-Cookie', setCookie);
    }

    cleanResponseHeaders(res, response.headers);
    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      let json = await response.json();
      
      // If we intercept getPlayer endpoint, rewrite the nested linktudi iframe source URL!
      if (json && json.data && json.data.video_url) {
        console.log(`[PROXY-PLENOFLU] Intercepted video_url: ${json.data.video_url}`);
        const originalVideoUrl = json.data.video_url;
        // Rewrite to load via our proxy player route!
        json.data.video_url = `/api/proxy-player?url=${encodeURIComponent(originalVideoUrl)}&referer=https://plenoflu.com/`;
      }
      res.json(json);
    } else if (contentType.includes('text/html') || contentType.includes('application/javascript') || contentType.includes('text/css')) {
      let text = await response.text();
      // Rewrite domains in text
      text = text.replace(/https:\/\/plenoflu\.com/g, '/proxy-plenoflu');
      text = text.replace(/http:\/\/plenoflu\.com/g, '/proxy-plenoflu');
      text = text.replace(/https:\/\/linktudi\.com/g, '/proxy-linktudi');
      text = text.replace(/http:\/\/linktudi\.com/g, '/proxy-linktudi');
      res.send(text);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('[PROXY-PLENOFLU] Error:', error);
    res.status(500).send('Erro no proxy Plenoflu.');
  }
});

// 3. Proxy Route for Linktudi requests
const handleLinktudiRequest = async (req, res, relativePath) => {
  const targetUrl = `https://linktudi.com${relativePath}`;
  console.log(`[PROXY-LINKTUDI] Forwarding: ${req.method} ${req.url} -> ${targetUrl}`);

  try {
    const headers = cleanRequestHeaders(req.headers, 'linktudi.com');
    headers['Referer'] = 'https://linktudi.com/embed2/tt33397980'; // Spoof Referer
    headers['Origin'] = 'https://linktudi.com';
    headers['User-Agent'] = USER_AGENT;

    const fetchOptions = {
      method: req.method,
      headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      let bodyData = req.body;
      
      // Specifically intercept getVideo POST data and override referrer parameter "r"
      if (req.url.includes('do=getVideo')) {
        console.log('[PROXY-LINKTUDI] Intercepted getVideo request! Overriding referer body parameter.');
        bodyData = { ...req.body };
        bodyData.r = 'https://plenoflu.com/'; // What linktudi expects as parent referer!
      }

      if (req.headers['content-type']?.includes('application/json')) {
        fetchOptions.body = JSON.stringify(bodyData);
      } else {
        fetchOptions.body = new URLSearchParams(bodyData).toString();
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward cookies
    const setCookie = response.headers.getSetCookie();
    if (setCookie && setCookie.length > 0) {
      res.setHeader('Set-Cookie', setCookie);
    }

    cleanResponseHeaders(res, response.headers);
    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || contentType.includes('application/javascript') || contentType.includes('text/css')) {
      let text = await response.text();
      // Rewrite domains in text
      text = text.replace(/https:\/\/linktudi\.com/g, '/proxy-linktudi');
      text = text.replace(/http:\/\/linktudi\.com/g, '/proxy-linktudi');
      
      // Rewrite jwplayer script paths to load locally
      text = text.replace(/\/player\/assets\/jwplayer/g, '/proxy-linktudi/player/assets/jwplayer');
      
      res.send(text);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('[PROXY-LINKTUDI] Error:', error);
    res.status(500).send('Erro no proxy Linktudi.');
  }
};

app.all('/proxy-linktudi/*', async (req, res) => {
  const relativePath = req.url.replace('/proxy-linktudi', '');
  await handleLinktudiRequest(req, res, relativePath);
});

// 4. Catch-all /player/* relative paths proxying directly to Linktudi
app.all('/player/*', async (req, res) => {
  await handleLinktudiRequest(req, res, req.url);
});

// Start Server
app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`[SERVER] Pobreflix Proxy running on http://localhost:${PORT}`);
  console.log(`========================================================`);
});
