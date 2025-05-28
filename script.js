// Global variables
let API_KEY = '';
let currentPage = 1;
let currentGenre = '';
let currentLanguage = '';
let currentYear = '';
let totalPages = 1;
let allMovies = [];
let genres = [];

// TMDb API endpoints
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check if API key is stored
    const storedApiKey = localStorage.getItem('tmdb_api_key');
    if (storedApiKey) {
        API_KEY = storedApiKey;
        initializeApp();
    }
});

// Set and validate API key
async function setApiKey() {
    const apiKeyInput = document.getElementById('api-key');
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showApiStatus('Please enter your TMDb API key.', 'error');
        return;
    }
    
    // Test the API key
    try {
        const response = await fetch(`${BASE_URL}/configuration?api_key=${apiKey}`);
        
        if (response.ok) {
            API_KEY = apiKey;
            localStorage.setItem('tmdb_api_key', apiKey);
            showApiStatus('API key validated successfully! 🎉', 'success');
            setTimeout(() => {
                initializeApp();
            }, 1500);
        } else {
            showApiStatus('Invalid API key. Please check and try again.', 'error');
        }
    } catch (error) {
        showApiStatus('Error validating API key. Please check your internet connection.', 'error');
    }
}

// Show API status message
function showApiStatus(message, type) {
    const statusDiv = document.getElementById('api-status');
    statusDiv.textContent = message;
    statusDiv.className = `api-status ${type}`;
    statusDiv.style.display = 'block';
}

// Initialize the application after API key is set
async function initializeApp() {
    document.getElementById('api-setup').style.display = 'none';
    document.getElementById('filters-section').style.display = 'block';
    
    await loadGenres();
    await searchMovies(); // Load popular movies by default
}

// Load genres from TMDb API
async function loadGenres() {
    try {
        const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en-US`);
        const data = await response.json();
        
        if (data.genres) {
            genres = data.genres;
            const genreSelect = document.getElementById('genre');
            
            data.genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre.id;
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

// Search movies based on filters
async function searchMovies(loadMore = false) {
    const searchBtn = document.getElementById('search-btn');
    const btnText = searchBtn.querySelector('.btn-text');
    const loader = searchBtn.querySelector('.loader');
    
    if (!loadMore) {
        currentPage = 1;
        allMovies = [];
        showLoading(true);
    }
    
    // Get filter values
    currentGenre = document.getElementById('genre').value;
    currentLanguage = document.getElementById('language').value;
    currentYear = document.getElementById('year').value;
    
    // Build API URL
    let apiUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=100&page=${currentPage}`;
    
    if (currentGenre) {
        apiUrl += `&with_genres=${currentGenre}`;
    }
    
    if (currentLanguage) {
        apiUrl += `&with_original_language=${currentLanguage}`;
    }
    
    if (currentYear) {
        apiUrl += `&year=${currentYear}`;
    }
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (response.ok && data.results) {
            totalPages = data.total_pages;
            
            if (!loadMore) {
                allMovies = data.results;
            } else {
                allMovies = [...allMovies, ...data.results];
            }
            
            await enrichMoviesWithIMDbRatings(data.results);
            displayMovies();
            
            // Update load more button
            const loadMoreContainer = document.getElementById('load-more-container');
            if (currentPage < totalPages && totalPages > 1) {
                loadMoreContainer.style.display = 'block';
            } else {
                loadMoreContainer.style.display = 'none';
            }
            
        } else {
            showError('Failed to fetch movies. Please try again.');
        }
    } catch (error) {
        console.error('Error fetching movies:', error);
        showError('Error fetching movies. Please check your internet connection.');
    } finally {
        showLoading(false);
    }
}

// Enrich movies with IMDb ratings (get additional details)
async function enrichMoviesWithIMDbRatings(movies) {
    const enrichedMovies = await Promise.all(
        movies.map(async (movie) => {
            try {
                const detailResponse = await fetch(`${BASE_URL}/movie/${movie.id}?api_key=${API_KEY}&language=en-US`);
                const details = await detailResponse.json();
                
                return {
                    ...movie,
                    imdb_id: details.imdb_id,
                    runtime: details.runtime,
                    budget: details.budget,
                    revenue: details.revenue
                };
            } catch (error) {
                return movie; // Return original movie if enrichment fails
            }
        })
    );
    
    // Update allMovies with enriched data
    if (currentPage === 1) {
        allMovies = enrichedMovies;
    } else {
        // Replace the last batch of movies with enriched versions
        const startIndex = allMovies.length - movies.length;
        allMovies.splice(startIndex, movies.length, ...enrichedMovies);
    }
}

// Display movies in the UI
function displayMovies() {
    const resultsSection = document.getElementById('results-section');
    const resultsCount = document.getElementById('results-count');
    const moviesContainer = document.getElementById('movies-container');
    const errorSection = document.getElementById('error-section');
    
    errorSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    if (allMovies.length === 0) {
        resultsSection.style.display = 'none';
        showError('No movies found matching your criteria. Try different filters.');
        return;
    }
    
    // Sort movies by vote_average (TMDb rating) descending
    const sortedMovies = [...allMovies].sort((a, b) => b.vote_average - a.vote_average);
    
    resultsCount.innerHTML = `Found ${allMovies.length} movie${allMovies.length > 1 ? 's' : ''} - Sorted by Rating`;
    
    if (currentPage === 1) {
        moviesContainer.innerHTML = '';
    }
    
    const startIndex = currentPage === 1 ? 0 : (currentPage - 1) * 20;
    const moviesToShow = sortedMovies.slice(startIndex);
    
    moviesToShow.forEach((movie, index) => {
        const movieCard = createMovieCard(movie, startIndex + index);
        moviesContainer.appendChild(movieCard);
    });
}

// Create individual movie card
function createMovieCard(movie, index) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${(index % 20) * 0.1}s`;
    
    const posterUrl = movie.poster_path 
        ? `${IMAGE_BASE_URL}${movie.poster_path}` 
        : null;
    
    const releaseYear = movie.release_date 
        ? new Date(movie.release_date).getFullYear() 
        : 'N/A';
    
    const genres = movie.genre_ids 
        ? movie.genre_ids.map(id => getGenreName(id)).filter(Boolean).join(', ')
        : 'Unknown';
    
    const language = getLanguageName(movie.original_language);
    
    const tmdbRating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    
    card.innerHTML = `
        <div class="movie-poster">
            ${posterUrl 
                ? `<img src="${posterUrl}" alt="${movie.title}" loading="lazy">` 
                : `<div class="placeholder">
                     <div class="icon">🎬</div>
                     <div class="text">No Poster Available</div>
                   </div>`
            }
        </div>
        <div class="movie-info">
            <h3 class="movie-title">${movie.title}</h3>
            <div class="movie-meta">
                <span class="movie-year">${releaseYear}</span>
                <div class="rating-section">
                    <div class="tmdb-rating">
                        <span class="star">⭐</span>
                        <span>${tmdbRating}</span>
                    </div>
                    ${movie.imdb_id ? `
                        <div class="imdb-rating">
                            <span>IMDb</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="movie-genre">${genres}</div>
            <div class="movie-language">${language}</div>
            ${movie.overview ? `
                <div class="movie-overview">${movie.overview.substring(0, 150)}${movie.overview.length > 150 ? '...' : ''}</div>
            ` : ''}
        </div>
    `;
    
    return card;
}

// Get genre name by ID
function getGenreName(genreId) {
    const genre = genres.find(g => g.id === genreId);
    return genre ? genre.name : '';
}

// Get language name by code
function getLanguageName(langCode) {
    const languages = {
        'en': 'English',
        'hi': 'Hindi',
        'es': 'Spanish',
        'fr': 'French',
        'ja': 'Japanese',
        'ko': 'Korean',
        'de': 'German',
        'it': 'Italian',
        'ta': 'Tamil',
        'te': 'Telugu',
        'zh': 'Chinese',
        'pt': 'Portuguese',
        'ru': 'Russian'
    };
    
    return languages[langCode] || langCode.toUpperCase();
}

// Load more movies
function loadMoreMovies() {
    currentPage++;
    searchMovies(true);
}

// Show loading state
function showLoading(isLoading) {
    const searchBtn = document.getElementById('search-btn');
    const btnText = searchBtn.querySelector('.btn-text');
    const loader = searchBtn.querySelector('.loader');
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    if (isLoading) {
        searchBtn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        if (loadMoreBtn) loadMoreBtn.disabled = true;
    } else {
        searchBtn.disabled = false;
        btnText.style.display = 'inline';
        loader.style.display = 'none';
        if (loadMoreBtn) loadMoreBtn.disabled = false;
    }
}

// Show error message
function showError(message) {
    const errorSection = document.getElementById('error-section');
    const errorMessage = document.getElementById('error-message');
    const resultsSection = document.getElementById('results-section');
    
    resultsSection.style.display = 'none';
    errorSection.style.display = 'block';
    errorMessage.textContent = message;
}

// Reset API key (for testing purposes)
function resetApiKey() {
    localStorage.removeItem('tmdb_api_key');
    location.reload();
}

// Add event listeners
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const target = e.target;
        if (target.id === 'api-key') {
            setApiKey();
        } else if (target.tagName === 'SELECT') {
            searchMovies();
        }
    }
});