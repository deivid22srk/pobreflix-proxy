const { spawn } = require('child_process');
const http = require('http');

console.log('====================================================');
console.log('        POBREFLIX PROXY - INTEGRATION TESTS        ');
console.log('====================================================\n');

// Start the server on a dynamic port for testing
const testPort = 3123;
const serverProcess = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: testPort },
  cwd: __dirname
});

serverProcess.stdout.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('running on')) {
    console.log('[TEST SERVER] Server started successfully!');
    runTests();
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('[TEST SERVER ERROR]', data.toString());
});

let failedTests = 0;
let passedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passedTests++;
  } else {
    console.log(`  ❌ FAILED: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  const baseUrl = `http://localhost:${testPort}`;
  
  try {
    // ----------------------------------------------------
    // TEST 1: Serve Static Frontend (Index Page)
    // ----------------------------------------------------
    console.log('\n[TEST 1] Testing static files root...');
    const homeRes = await fetch(`${baseUrl}/`);
    assert(homeRes.status === 200, 'Frontend root returned status 200');
    const homeText = await homeRes.text();
    assert(homeText.includes('Pobreflix Proxy'), 'Root page contains title "Pobreflix Proxy"');

    // ----------------------------------------------------
    // TEST 2: Scrape Homepage API
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing /api/home scraper...');
    const homeApiRes = await fetch(`${baseUrl}/api/home`);
    assert(homeApiRes.status === 200, '/api/home returned status 200');
    const homeData = await homeApiRes.json();
    assert(Array.isArray(homeData.featured) && homeData.featured.length > 0, 'Homepage contains featured items');
    assert(Array.isArray(homeData.movies) && homeData.movies.length > 0, 'Homepage contains movies list');
    assert(Array.isArray(homeData.series) && homeData.series.length > 0, 'Homepage contains series list');
    assert(Array.isArray(homeData.seasons) && homeData.seasons.length > 0, 'Homepage contains seasons list');
    
    // Check item structure
    if (homeData.movies && homeData.movies.length > 0) {
      const firstMovie = homeData.movies[0];
      assert(firstMovie.title, 'Movie item has a title');
      assert(firstMovie.path && firstMovie.path.startsWith('/'), 'Movie item has a relative path');
      assert(firstMovie.img && firstMovie.img.startsWith('http'), 'Movie item has a poster image URL');
      assert(firstMovie.type === 'movie', 'Movie item has type "movie"');
    }

    // ----------------------------------------------------
    // TEST 3: Search API
    // ----------------------------------------------------
    console.log('\n[TEST 3] Testing /api/search scraper...');
    const searchRes = await fetch(`${baseUrl}/api/search?q=homem`);
    assert(searchRes.status === 200, '/api/search returned status 200');
    const searchResults = await searchRes.json();
    assert(Array.isArray(searchResults) && searchResults.length > 0, 'Search returned results');
    
    if (searchResults && searchResults.length > 0) {
      const firstSearch = searchResults[0];
      assert(firstSearch.title && firstSearch.title.toLowerCase().includes('homem'), 'Search result title contains search query');
      assert(firstSearch.path && firstSearch.path.startsWith('/'), 'Search result has relative path');
    }

    // ----------------------------------------------------
    // TEST 4: Movie Details API
    // ----------------------------------------------------
    console.log('\n[TEST 4] Testing Movie Details /api/details...');
    // Let's use the movie from the home page
    const moviePath = homeData.movies[0].path;
    console.log(`  Scraping movie path: ${moviePath}`);
    const movieDetailsRes = await fetch(`${baseUrl}/api/details?path=${encodeURIComponent(moviePath)}`);
    assert(movieDetailsRes.status === 200, '/api/details (movie) returned status 200');
    const movieDetails = await movieDetailsRes.json();
    
    assert(movieDetails.type === 'movie', 'Details type is "movie"');
    assert(movieDetails.title && movieDetails.title.length > 0, 'Movie details has title');
    assert(movieDetails.poster && movieDetails.poster.startsWith('http'), 'Movie details has poster URL');
    assert(movieDetails.description && movieDetails.description.length > 0, 'Movie details has description');
    assert(Array.isArray(movieDetails.players) && movieDetails.players.length > 0, 'Movie details has players list');
    
    if (movieDetails.players && movieDetails.players.length > 0) {
      const player = movieDetails.players[0];
      assert(player.title, 'Player option has a title');
      assert(player.src && player.src.startsWith('http'), 'Player option has iframe source URL');
    }

    // ----------------------------------------------------
    // TEST 5: Series Details API
    // ----------------------------------------------------
    console.log('\n[TEST 5] Testing Series Details /api/details...');
    const seriesPath = homeData.series[0].path;
    console.log(`  Scraping series path: ${seriesPath}`);
    const seriesDetailsRes = await fetch(`${baseUrl}/api/details?path=${encodeURIComponent(seriesPath)}`);
    assert(seriesDetailsRes.status === 200, '/api/details (series) returned status 200');
    const seriesDetails = await seriesDetailsRes.json();
    
    assert(seriesDetails.type === 'series', 'Details type is "series"');
    assert(seriesDetails.title && seriesDetails.title.length > 0, 'Series details has title');
    assert(Array.isArray(seriesDetails.seasons) && seriesDetails.seasons.length > 0, 'Series details has seasons');
    
    if (seriesDetails.seasons && seriesDetails.seasons.length > 0) {
      const firstSeason = seriesDetails.seasons[0];
      assert(firstSeason.title, 'Season has title');
      assert(Array.isArray(firstSeason.episodes) && firstSeason.episodes.length > 0, 'Season contains episodes list');
      
      if (firstSeason.episodes && firstSeason.episodes.length > 0) {
        const episode = firstSeason.episodes[0];
        assert(episode.numerando, 'Episode has number ID');
        assert(episode.name, 'Episode has name');
        assert(episode.path && episode.path.startsWith('/episodios/'), 'Episode has episodes path');
      }
    }

    // ----------------------------------------------------
    // TEST 6: Proxy Player HTML
    // ----------------------------------------------------
    console.log('\n[TEST 6] Testing Player Proxy (/api/proxy-player)...');
    if (movieDetails.players && movieDetails.players.length > 0) {
      const playerUrl = movieDetails.players[0].src;
      console.log(`  Proxying player URL: ${playerUrl}`);
      const proxyPlayerRes = await fetch(`${baseUrl}/api/proxy-player?url=${encodeURIComponent(playerUrl)}`);
      assert(proxyPlayerRes.status === 200, '/api/proxy-player returned status 200');
      
      const proxyText = await proxyPlayerRes.text();
      assert(proxyText.includes('/proxy-plenoflu') || proxyText.includes('/proxy-linktudi'), 'Player HTML contains rewritten URLs');
      assert(proxyPlayerRes.headers.get('x-frame-options') === 'ALLOWALL', 'Stripped X-Frame-Options allows embedding');
    }

  } catch (error) {
    console.error('Test execution error:', error);
    failedTests++;
  } finally {
    // ----------------------------------------------------
    // FINISH AND REPORT
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log('                TEST REPORT SUMMARY                 ');
    console.log('====================================================');
    console.log(`  TOTAL TESTS: ${passedTests + failedTests}`);
    console.log(`  PASSED:      ${passedTests}`);
    console.log(`  FAILED:      ${failedTests}`);
    console.log('====================================================\n');
    
    serverProcess.kill();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}
