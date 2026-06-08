// App state
let homeData = null;
let currentView = 'home'; // 'home', 'search', 'details'
let activeFilter = 'all'; // 'all', 'movies', 'series'
let currentScrollPositions = {};

// On Load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Header scroll effect
  window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
});

async function initApp() {
  await fetchHomeData();
  renderHome();
}

// Fetch home page data
async function fetchHomeData() {
  try {
    const response = await fetch('/api/home');
    homeData = await response.json();
  } catch (error) {
    console.error('Erro ao buscar dados da home:', error);
    showNotification('Falha ao carregar os dados. Verifique a conexão.', 'error');
  }
}

// Notification Helper
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.app-notification');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `app-notification ${type}`;
  el.innerHTML = `
    <i class="${type === 'error' ? 'ri-error-warning-line' : 'ri-information-line'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 100);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// Render Home View
function renderHome() {
  if (!homeData) return;
  
  // Hero section setup
  setupHero();
  
  // Render rows
  const featuredContainer = document.getElementById('row-featured');
  const moviesContainer = document.getElementById('row-movies');
  const seriesContainer = document.getElementById('row-series');
  
  // Filter sections
  const moviesSection = document.getElementById('row-movies-container');
  const seriesSection = document.getElementById('row-series-container');
  
  // Clear lists
  featuredContainer.innerHTML = '';
  moviesContainer.innerHTML = '';
  seriesContainer.innerHTML = '';
  
  // Filter featured based on activeFilter
  let featuredList = homeData.featured || [];
  if (activeFilter === 'movies') {
    featuredList = featuredList.filter(item => item.type === 'movie');
    moviesSection.style.display = 'block';
    seriesSection.style.display = 'none';
  } else if (activeFilter === 'series') {
    featuredList = featuredList.filter(item => item.type === 'tv');
    moviesSection.style.display = 'none';
    seriesSection.style.display = 'block';
  } else {
    moviesSection.style.display = 'block';
    seriesSection.style.display = 'block';
  }

  // Populate Featured
  if (featuredList.length === 0) {
    featuredContainer.innerHTML = '<p class="empty-row-msg">Nenhum destaque encontrado.</p>';
  } else {
    featuredList.forEach(item => {
      featuredContainer.appendChild(createCard(item));
    });
  }

  // Populate Movies
  const moviesList = homeData.movies || [];
  if (moviesList.length === 0) {
    moviesContainer.innerHTML = '<p class="empty-row-msg">Nenhum filme encontrado.</p>';
  } else {
    moviesList.forEach(item => {
      moviesContainer.appendChild(createCard(item));
    });
  }

  // Populate Series
  const seriesList = homeData.series || [];
  if (seriesList.length === 0) {
    seriesContainer.innerHTML = '<p class="empty-row-msg">Nenhuma série encontrada.</p>';
  } else {
    seriesList.forEach(item => {
      seriesContainer.appendChild(createCard(item));
    });
  }
}

// Setup Banner/Hero section
function setupHero() {
  const heroSection = document.getElementById('hero-section');
  const heroContent = document.getElementById('hero-content');
  
  let candidates = homeData.featured || [];
  if (activeFilter === 'movies') {
    candidates = candidates.filter(item => item.type === 'movie');
  } else if (activeFilter === 'series') {
    candidates = candidates.filter(item => item.type === 'tv');
  }
  
  if (candidates.length === 0) {
    heroSection.style.display = 'none';
    return;
  }
  
  heroSection.style.display = 'flex';
  
  // Pick a random or first item
  const item = candidates[0];
  
  // Set background image
  heroSection.style.backgroundImage = `url('${item.img}')`;
  
  heroContent.innerHTML = `
    <span class="hero-tag">${item.type === 'movie' ? 'Filme Destaque' : 'Série Destaque'}</span>
    <h1 class="hero-title">${item.title}</h1>
    <div class="hero-meta">
      ${item.rating ? `<span class="hero-meta-item hero-rating"><i class="ri-star-fill"></i> ${item.rating}</span>` : ''}
      ${item.year ? `<span class="hero-meta-item"><i class="ri-calendar-line"></i> ${item.year}</span>` : ''}
    </div>
    <p class="hero-description">Disponível em qualidade premium sem anúncios. Assista agora mesmo pelo nosso proxy otimizado.</p>
    <div class="hero-actions">
      <button class="btn btn-primary" onclick="openDetails('${item.path}')">
        <i class="ri-play-fill"></i> Assistir Agora
      </button>
    </div>
  `;
}

// Create Card Element
function createCard(item) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.onclick = () => openDetails(item.path);
  
  // Determine Type Badge
  let badgeClass = 'movie';
  let badgeLabel = 'Filme';
  if (item.type === 'tv') {
    badgeClass = 'tv';
    badgeLabel = 'Série';
  } else if (item.type === 'season') {
    badgeClass = 'season';
    badgeLabel = 'Temp.';
  }
  
  card.innerHTML = `
    <div class="card-poster">
      <img src="${item.img || 'https://via.placeholder.com/185x260?text=Sem+Poster'}" alt="${item.title}" loading="lazy">
      <div class="card-overlay">
        ${item.rating ? `<span class="card-rating"><i class="ri-star-fill"></i> ${item.rating}</span>` : '<span></span>'}
        <span class="card-type-badge ${badgeClass}">${badgeLabel}</span>
      </div>
    </div>
    <div class="card-info">
      <h3 class="card-title" title="${item.title}">${item.title}</h3>
      <div class="card-meta">
        <span>${item.year || ''}</span>
      </div>
    </div>
  `;
  return card;
}

// Navigation / Filtering
function filterType(type, event) {
  if (event) event.preventDefault();
  
  // Update nav UI
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (type === 'all') document.getElementById('nav-home').classList.add('active');
  if (type === 'movies') document.getElementById('nav-movies').classList.add('active');
  if (type === 'series') document.getElementById('nav-series').classList.add('active');
  
  activeFilter = type;
  navigateToHome();
  renderHome();
}

function navigateToHome() {
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search').style.display = 'none';
  
  showView('home');
}

function showView(view) {
  currentView = view;
  
  document.getElementById('home-view').style.display = view === 'home' ? 'block' : 'none';
  document.getElementById('search-view').style.display = view === 'search' ? 'block' : 'none';
  document.getElementById('details-view').style.display = view === 'details' ? 'block' : 'none';
  
  if (view === 'home') {
    document.getElementById('hero-section').style.display = 'flex';
    window.scrollTo(0, 0);
  } else {
    document.getElementById('hero-section').style.display = 'none';
    window.scrollTo(0, 0);
  }
}

// Search Logic
async function handleSearch(event) {
  if (event) event.preventDefault();
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;
  
  document.getElementById('clear-search').style.display = 'block';
  showView('search');
  
  const titleEl = document.getElementById('search-title');
  titleEl.innerHTML = `Buscando por "${query}"...`;
  
  const grid = document.getElementById('search-results-grid');
  const noResults = document.getElementById('search-no-results');
  
  // Show skeletons
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="movie-card skeleton card-skeleton"></div>
  `).join('');
  noResults.style.display = 'none';
  
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const results = await res.json();
    
    grid.innerHTML = '';
    titleEl.innerHTML = `Resultados para "${query}"`;
    
    if (results.length === 0) {
      noResults.style.display = 'block';
    } else {
      results.forEach(item => {
        grid.appendChild(createCard(item));
      });
    }
  } catch (error) {
    console.error('Erro na pesquisa:', error);
    grid.innerHTML = '';
    noResults.style.display = 'block';
    titleEl.innerHTML = `Erro ao buscar "${query}"`;
  }
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search').style.display = 'none';
  navigateToHome();
}

// Open Details View
async function openDetails(path) {
  showView('details');
  const container = document.getElementById('details-container');
  
  // Loading skeleton screen
  container.innerHTML = `
    <div class="details-hero">
      <div class="details-poster skeleton" style="height: 450px;"></div>
      <div class="details-info">
        <div class="skeleton" style="height: 45px; width: 60%; margin-bottom: 1.5rem;"></div>
        <div class="skeleton" style="height: 25px; width: 40%; margin-bottom: 1.5rem;"></div>
        <div class="skeleton" style="height: 20px; width: 90%; margin-bottom: 0.8rem;"></div>
        <div class="skeleton" style="height: 20px; width: 85%; margin-bottom: 0.8rem;"></div>
        <div class="skeleton" style="height: 20px; width: 70%; margin-bottom: 1.5rem;"></div>
      </div>
    </div>
  `;
  
  try {
    // We pass path parameter to get scraped details
    const res = await fetch(`/api/details?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Details not found');
    const data = await res.json();
    
    renderDetails(data, path);
  } catch (error) {
    console.error('Erro ao abrir detalhes:', error);
    container.innerHTML = `
      <div class="no-results">
        <i class="ri-error-warning-line no-results-icon"></i>
        <h3>Erro ao carregar detalhes</h3>
        <p>Não foi possível obter as informações deste item. O site de origem pode estar offline ou instável.</p>
        <button class="btn btn-secondary" onclick="navigateToHome()" style="margin-top: 1.5rem;">Voltar ao Início</button>
      </div>
    `;
  }
}

// Render Details View Content
function renderDetails(data, path) {
  const container = document.getElementById('details-container');
  
  // Decide layout depending on Type
  const isMovie = data.type === 'movie';
  const isEpisode = data.type === 'episode';
  const isSeries = data.type === 'series';
  
  let headerHtml = '';
  let mainContentHtml = '';
  
  // Render common details layout
  headerHtml = `
    <div class="details-hero">
      <div class="details-poster">
        <img src="${data.poster || 'https://via.placeholder.com/300x450?text=Sem+Poster'}" alt="${data.title}">
      </div>
      <div class="details-info">
        <div class="details-title-section">
          <h1 class="details-title">${data.title}</h1>
          ${data.subtitle ? `<h3 class="details-subtitle">${data.subtitle}</h3>` : ''}
        </div>
        
        <div class="details-meta-row">
          ${data.date ? `<span class="details-meta-item"><i class="ri-calendar-line"></i> ${data.date}</span>` : ''}
          ${data.rating ? `<span class="details-meta-item details-meta-rating"><i class="ri-star-fill"></i> ${data.rating}</span>` : ''}
          ${data.runtime ? `<span class="details-meta-item"><i class="ri-time-line"></i> ${data.runtime}</span>` : ''}
          ${data.country ? `<span class="details-meta-badge">${data.country}</span>` : ''}
          <span class="details-meta-badge" style="text-transform: uppercase;">${data.type}</span>
        </div>
        
        ${data.genres && data.genres.length > 0 ? `
          <div class="details-genres">
            ${data.genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}
          </div>
        ` : ''}
        
        ${data.description ? `
          <div class="details-overview">
            <h3>Sinopse</h3>
            <p>${data.description}</p>
          </div>
        ` : ''}
        
        <button class="btn btn-secondary" onclick="navigateToHome()"><i class="ri-home-4-line"></i> Início</button>
      </div>
    </div>
  `;

  // Render Video Player if Movie or Episode
  if ((isMovie || isEpisode) && data.players && data.players.length > 0) {
    mainContentHtml = `
      <div class="player-wrapper">
        <div class="player-header">
          <span class="player-title"><i class="ri-play-circle-line" style="color: var(--primary-color);"></i> Assistir Conteúdo</span>
          <div class="player-channels">
            ${data.players.map((p, idx) => `
              <button class="channel-btn ${idx === 0 ? 'active' : ''}" onclick="changePlayerChannel(this, '${encodeURIComponent(p.src)}')">
                ${p.title || `Opção ${idx + 1}`}
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="video-container">
          <!-- We load the first player source in our proxy player route -->
          <iframe id="video-player-iframe" src="/api/proxy-player?url=${encodeURIComponent(data.players[0].src)}&referer=https://www.pobreflix.you/" allowfullscreen></iframe>
        </div>
      </div>
    `;
  }

  // Render Seasons & Episodes if Series
  if (isSeries && data.seasons && data.seasons.length > 0) {
    mainContentHtml = `
      <div class="seasons-section">
        <div class="seasons-header-row">
          <span class="seasons-title"><i class="ri-list-check" style="color: var(--accent-color);"></i> Episódios & Temporadas</span>
          <div class="season-selector-wrapper">
            <span class="season-select-label">Temporada:</span>
            <select class="season-select" id="season-selector" onchange="switchSeason(this)">
              ${data.seasons.map((s, idx) => `
                <option value="${idx}">${s.title}</option>
              `).join('')}
            </select>
          </div>
        </div>
        
        <div class="episodes-grid" id="episodes-container">
          <!-- Episodes will be loaded dynamically based on dropdown selection -->
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    ${headerHtml}
    ${mainContentHtml}
  `;

  // If it's a series, trigger loading of season 0 episodes
  if (isSeries && data.seasons && data.seasons.length > 0) {
    renderEpisodes(data.seasons[0].episodes);
  }
}

// Switch Season Event
function switchSeason(selectEl) {
  const seasonIdx = selectEl.value;
  // We need to fetch the current active series data from the details object
  // Since we don't store it globally directly, we can read the HTML or store it in window
  const activeSeason = window.currentDetailsData.seasons[seasonIdx];
  renderEpisodes(activeSeason.episodes);
}

// Render Episodes Grid
function renderEpisodes(episodes) {
  const container = document.getElementById('episodes-container');
  if (!episodes || episodes.length === 0) {
    container.innerHTML = '<p class="empty-row-msg">Nenhum episódio nesta temporada.</p>';
    return;
  }
  
  container.innerHTML = '';
  episodes.forEach(ep => {
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.onclick = () => openDetails(ep.path);
    
    card.innerHTML = `
      <div class="episode-thumbnail">
        <img src="${ep.img || 'https://via.placeholder.com/280x158?text=Sem+Poster'}" alt="${ep.name}" loading="lazy">
        <div class="episode-play-overlay">
          <i class="ri-play-circle-fill episode-play-icon"></i>
        </div>
        <span class="episode-number-badge">${ep.numerando || ''}</span>
      </div>
      <div class="episode-info">
        <div class="episode-title-row">
          <h4 class="episode-name">${ep.name}</h4>
          ${ep.date ? `<span class="episode-date">${ep.date}</span>` : ''}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Cache active details data to window for season switching helper
const originalRenderDetails = renderDetails;
renderDetails = function(data, path) {
  window.currentDetailsData = data;
  originalRenderDetails(data, path);
};

// Change Player Source Channel
function changePlayerChannel(button, encodedSrc) {
  // Update active state class on tabs
  const parent = button.parentElement;
  parent.querySelectorAll('.channel-btn').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  
  const iframe = document.getElementById('video-player-iframe');
  const src = decodeURIComponent(encodedSrc);
  
  // Set new iframe URL proxy
  iframe.src = `/api/proxy-player?url=${encodeURIComponent(src)}&referer=https://www.pobreflix.you/`;
}
