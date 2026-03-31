/**
 * script.js
 * Loads films.json, renders an interactive table/card view,
 * and draws a revenue bar chart using Chart.js.
 */

// ── State ─────────────────────────────────────────────────────────────────────
let allFilms = [];          // Raw data from JSON
let filteredFilms = [];     // Currently displayed subset
let sortKey = 'box_office_usd';
let sortAsc = false;        // Default: highest revenue first
let viewMode = 'grid';      // 'grid' | 'table'
let chart = null;           // Chart.js instance

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const searchInput    = document.getElementById('search');
const countrySelect  = document.getElementById('filter-country');
const yearFromInput  = document.getElementById('year-from');
const yearToInput    = document.getElementById('year-to');
const container      = document.getElementById('films-container');
const resultInfo     = document.getElementById('result-info');
const statTotal      = document.getElementById('stat-total');
const statTopGross   = document.getElementById('stat-top-gross');
const statTopYear    = document.getElementById('stat-top-year');
const statCountries  = document.getElementById('stat-countries');
const btnGrid        = document.getElementById('btn-grid');
const btnTable       = document.getElementById('btn-table');

// ── Fetch Data ────────────────────────────────────────────────────────────────
async function loadFilms() {
  try {
    const resp = await fetch('films.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    allFilms = await resp.json();
    init();
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Could not load films.json — run the Jupyter notebook first.<br>
           <small style="opacity:.6">${err.message}</small></p>
      </div>`;
    console.error('Failed to load films.json:', err);
  }
}

// ── Initialise ────────────────────────────────────────────────────────────────
function init() {
  populateCountryFilter();
  setYearBounds();
  updateStats();
  applyFilters();
  renderChart();
}

// ── Populate Country Dropdown ─────────────────────────────────────────────────
function populateCountryFilter() {
  // Flatten multi-country strings like "United States, United Kingdom"
  const countriesSet = new Set();
  allFilms.forEach(f => {
    if (f.country && f.country !== 'N/A') {
      f.country.split(/,\s*/).forEach(c => countriesSet.add(c.trim()));
    }
  });
  const sorted = [...countriesSet].sort();
  sorted.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });
}

// ── Year Bounds ───────────────────────────────────────────────────────────────
function setYearBounds() {
  const years = allFilms.map(f => f.release_year).filter(Boolean);
  const min = Math.min(...years);
  const max = Math.max(...years);
  yearFromInput.value = min;
  yearToInput.value   = max;
  yearFromInput.min   = min;
  yearFromInput.max   = max;
  yearToInput.min     = min;
  yearToInput.max     = max;
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function updateStats() {
  statTotal.textContent = allFilms.length;
  const topFilm = allFilms.reduce((a, b) => (a.box_office_usd > b.box_office_usd ? a : b), allFilms[0]);
  statTopGross.textContent = topFilm ? topFilm.box_office : '—';

  // Most common decade
  const decadeCounts = {};
  allFilms.forEach(f => {
    if (f.release_year) {
      const decade = Math.floor(f.release_year / 10) * 10;
      decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
    }
  });
  const topDecade = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0];
  statTopYear.textContent = topDecade ? `${topDecade[0]}s` : '—';

  const countriesSet = new Set();
  allFilms.forEach(f => {
    if (f.country && f.country !== 'N/A') {
      f.country.split(/,\s*/).forEach(c => countriesSet.add(c.trim()));
    }
  });
  statCountries.textContent = countriesSet.size;
}

// ── Filter + Sort ─────────────────────────────────────────────────────────────
function applyFilters() {
  const query   = searchInput.value.toLowerCase().trim();
  const country = countrySelect.value;
  const yearFrom = parseInt(yearFromInput.value) || 0;
  const yearTo   = parseInt(yearToInput.value)   || 9999;

  filteredFilms = allFilms.filter(f => {
    const matchSearch = !query ||
      f.title.toLowerCase().includes(query) ||
      (f.director && f.director.toLowerCase().includes(query));

    const matchCountry = !country || (f.country && f.country.includes(country));

    const yr = f.release_year || 0;
    const matchYear = yr >= yearFrom && yr <= yearTo;

    return matchSearch && matchCountry && matchYear;
  });

  // Sort
  filteredFilms.sort((a, b) => {
    let va = a[sortKey];
    let vb = b[sortKey];
    if (va == null) va = sortKey === 'box_office_usd' ? 0 : '';
    if (vb == null) vb = sortKey === 'box_office_usd' ? 0 : '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  resultInfo.textContent = `Showing ${filteredFilms.length} of ${allFilms.length} films`;
  render();
}

// ── Render Dispatcher ─────────────────────────────────────────────────────────
function render() {
  container.className = viewMode;
  if (filteredFilms.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>No films match your search.</p>
      </div>`;
    return;
  }
  viewMode === 'grid' ? renderCards() : renderTable();
}

// ── Card View ─────────────────────────────────────────────────────────────────
function renderCards() {
  container.innerHTML = filteredFilms.map(f => `
    <article class="film-card">
      <div class="card-rank">Rank #${f.rank || f.id}</div>
      <div class="card-title">${escapeHtml(f.title)}</div>
      <div class="card-meta">
        ${f.release_year ? `<span class="badge year">${f.release_year}</span>` : ''}
        ${f.country && f.country !== 'N/A' ? `<span class="badge country">${escapeHtml(firstCountry(f.country))}</span>` : ''}
      </div>
      <div class="card-revenue">${escapeHtml(f.box_office || '—')}</div>
      <div class="card-director">
        ${f.director && f.director !== 'N/A'
          ? `Dir. <span>${escapeHtml(truncate(f.director, 60))}</span>`
          : '<span style="opacity:.5">Director unknown</span>'}
      </div>
    </article>
  `).join('');
}

// ── Table View ────────────────────────────────────────────────────────────────
function renderTable() {
  const headers = [
    { key: 'rank',          label: '#',          cls: 'col-rank' },
    { key: 'title',         label: 'Title',       cls: 'col-title' },
    { key: 'release_year',  label: 'Year',        cls: 'col-year' },
    { key: 'box_office_usd',label: 'Box Office',  cls: 'col-revenue' },
    { key: 'director',      label: 'Director',    cls: 'col-director' },
    { key: 'country',       label: 'Country',     cls: 'col-country' },
  ];

  const thead = headers.map(h => {
    const isSorted = sortKey === h.key;
    const icon = isSorted ? (sortAsc ? '▲' : '▼') : '⇅';
    return `<th class="${isSorted ? 'sorted' : ''}" data-key="${h.key}">
              ${h.label} <span class="sort-icon">${icon}</span>
            </th>`;
  }).join('');

  const tbody = filteredFilms.map(f => `
    <tr>
      <td class="col-rank">${escapeHtml(f.rank || String(f.id))}</td>
      <td class="col-title">${escapeHtml(f.title)}</td>
      <td class="col-year">${f.release_year || '—'}</td>
      <td class="col-revenue">${escapeHtml(f.box_office || '—')}</td>
      <td class="col-director">${escapeHtml(truncate(f.director || '—', 50))}</td>
      <td class="col-country">${escapeHtml(firstCountry(f.country || '—'))}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="films-table">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;

  // Attach sort click handlers
  container.querySelectorAll('th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = key !== 'box_office_usd'; // Default asc for text, desc for revenue
      }
      applyFilters();
    });
  });
}

// ── Revenue Chart (Top 15) ────────────────────────────────────────────────────
function renderChart() {
  const top15 = [...allFilms]
    .filter(f => f.box_office_usd)
    .sort((a, b) => b.box_office_usd - a.box_office_usd)
    .slice(0, 15);

  const labels  = top15.map(f => truncate(f.title, 22));
  const data    = top15.map(f => +(f.box_office_usd / 1e9).toFixed(3));
  const colors  = top15.map((_, i) =>
    `hsl(${42 - i * 2.5}, ${85 - i * 1.5}%, ${55 - i * 1.2}%)`
  );

  const ctx = document.getElementById('revenueChart').getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Box Office Revenue (USD billions)',
        data,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` $${ctx.parsed.y.toFixed(2)}B`,
            title: ctx => top15[ctx[0].dataIndex].title,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#8b949e', font: { size: 11 }, maxRotation: 35 },
          grid: { color: 'rgba(48,54,61,.6)' },
        },
        y: {
          ticks: {
            color: '#8b949e',
            callback: v => `$${v}B`,
          },
          grid: { color: 'rgba(48,54,61,.6)' },
        },
      },
    },
  });
}

// ── View Toggle ───────────────────────────────────────────────────────────────
btnGrid.addEventListener('click', () => {
  viewMode = 'grid';
  btnGrid.classList.add('active');
  btnTable.classList.remove('active');
  render();
});
btnTable.addEventListener('click', () => {
  viewMode = 'table';
  btnTable.classList.add('active');
  btnGrid.classList.remove('active');
  render();
});

// ── Event Listeners for Filters ───────────────────────────────────────────────
searchInput.addEventListener('input', applyFilters);
countrySelect.addEventListener('change', applyFilters);
yearFromInput.addEventListener('input', applyFilters);
yearToInput.addEventListener('input', applyFilters);

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

/** Return only the first country from a comma-separated list. */
function firstCountry(str) {
  if (!str || str === 'N/A') return str;
  return str.split(/,\s*/)[0].trim();
}

// ── Kick Off ──────────────────────────────────────────────────────────────────
loadFilms();
