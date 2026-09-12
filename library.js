(() => {
  const API = 'https://admin.labib.fun/api/library';

  async function getItems() {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) throw new Error('Library unavailable');
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  }

  function updateHome(items) {
    const songs = items.filter(i => i.category === 'songs').length;
    const visuals = items.filter(i => i.category === 'photos' || i.category === 'arts').length;
    const total = items.length;
    [['homeSongCount', songs], ['homeVisualCount', visuals], ['homeTotalCount', total]].forEach(([id, n]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = n;
    });
  }

  async function homeStats() {
    try { updateHome(await getItems()); }
    catch (_) { /* keep graceful zero state */ }
  }

  function esc(s='') {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function initLibraryPage() {
    const root = document.getElementById('libraryApp');
    if (!root) return;

    const tabs = [...document.querySelectorAll('.library-tab')];
    const grid = document.getElementById('libraryGrid');
    const empty = document.getElementById('libraryEmpty');
    const countEls = {
      songs: document.getElementById('librarySongsCount'),
      visuals: document.getElementById('libraryVisualCount'),
      total: document.getElementById('libraryTotalCount')
    };
    const player = document.getElementById('libraryPlayer');
    const audio = document.getElementById('libraryAudio');
    const nowTitle = document.getElementById('nowPlayingTitle');
    const nowMeta = document.getElementById('nowPlayingMeta');
    const playBtn = document.getElementById('playerPlay');
    const prevBtn = document.getElementById('playerPrev');
    const nextBtn = document.getElementById('playerNext');
    const progress = document.getElementById('playerProgress');
    const currentTime = document.getElementById('playerCurrent');
    const duration = document.getElementById('playerDuration');
    const volume = document.getElementById('playerVolume');

    let items = [], filter = 'songs', songIndex = -1;

    const fmt = s => {
      if (!Number.isFinite(s)) return '0:00';
      const m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return `${m}:${String(sec).padStart(2,'0')}`;
    };

    function visible() {
      return filter === 'all' ? items : items.filter(i => i.category === filter);
    }

    function render() {
      const list = visible();
      grid.innerHTML = list.map((item, i) => {
        if (item.category === 'songs') return `
          <article class="library-item song-item">
            <button class="song-open" data-song="${esc(item.id)}" aria-label="Play ${esc(item.name)}">
              <span class="media-icon">▶</span>
            </button>
            <div class="library-item-copy"><h3>${esc(item.name)}</h3><p>Song · ${fmtBytes(item.size)}</p></div>
            <button class="mini-play" data-song="${esc(item.id)}" aria-label="Play song">Play</button>
          </article>`;
        return `
          <article class="library-item visual-item">
            <button class="visual-open" data-image="${esc(item.mediaUrl)}" data-name="${esc(item.name)}" aria-label="View ${esc(item.name)}">
              <img src="${esc(item.mediaUrl)}" alt="${esc(item.name)}" loading="lazy">
            </button>
            <div class="library-item-copy"><h3>${esc(item.name)}</h3><p>${item.category === 'arts' ? 'Art' : 'Photo'} · ${fmtBytes(item.size)}</p></div>
          </article>`;
      }).join('');
      empty.hidden = list.length !== 0;
      grid.hidden = list.length === 0;
      grid.querySelectorAll('[data-song]').forEach(b => b.addEventListener('click', () => playById(b.dataset.song)));
      grid.querySelectorAll('[data-image]').forEach(b => b.addEventListener('click', () => openLightbox(b.dataset.image, b.dataset.name)));
    }

    function fmtBytes(bytes=0) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${Math.round(bytes/1024)} KB`;
      return `${(bytes/1048576).toFixed(1)} MB`;
    }

    function setSong(id) {
      const item = items.find(i => i.id === id && i.category === 'songs');
      if (!item) return;
      songIndex = items.filter(i => i.category === 'songs').findIndex(i => i.id === id);
      audio.src = item.mediaUrl;
      nowTitle.textContent = item.name;
      nowMeta.textContent = 'My Library · Song';
      player.hidden = false;
      audio.play().then(() => { playBtn.textContent = '❚❚'; }).catch(() => { playBtn.textContent = '▶'; });
    }

    function playById(id) { setSong(id); }

    playBtn.addEventListener('click', () => {
      if (!audio.src) return;
      if (audio.paused) { audio.play(); playBtn.textContent='❚❚'; }
      else { audio.pause(); playBtn.textContent='▶'; }
    });
    function songList() { return items.filter(i => i.category === 'songs'); }
    prevBtn.addEventListener('click', () => {
      const s=songList(); if (!s.length) return;
      setSong(s[(songIndex-1+s.length)%s.length].id);
    });
    nextBtn.addEventListener('click', () => {
      const s=songList(); if (!s.length) return;
      setSong(s[(songIndex+1)%s.length].id);
    });
    audio.addEventListener('loadedmetadata', () => duration.textContent = fmt(audio.duration));
    audio.addEventListener('timeupdate', () => {
      currentTime.textContent = fmt(audio.currentTime);
      progress.value = audio.duration ? (audio.currentTime/audio.duration)*100 : 0;
    });
    audio.addEventListener('ended', () => {
      const s=songList(); if (s.length) setSong(s[(songIndex+1)%s.length].id);
    });
    progress.addEventListener('input', () => { if (audio.duration) audio.currentTime=(progress.value/100)*audio.duration; });
    volume.addEventListener('input', () => audio.volume=Number(volume.value));

    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      tab.classList.add('active'); tab.setAttribute('aria-selected','true');
      filter=tab.dataset.filter; render();
    }));

    const close = document.getElementById('lightboxClose');
    const lightbox = document.getElementById('libraryLightbox');
    function openLightbox(src,name) {
      lightbox.querySelector('img').src=src;
      lightbox.querySelector('img').alt=name;
      lightbox.querySelector('.lightbox-name').textContent=name;
      lightbox.hidden=false;
      document.body.classList.add('lightbox-open');
    }
    function closeLightbox(){lightbox.hidden=true;document.body.classList.remove('lightbox-open');}
    close.addEventListener('click',closeLightbox);
    lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!lightbox.hidden)closeLightbox();});

    getItems().then(data => {
      items=data;
      updateHome(items);
      const songs=items.filter(i=>i.category==='songs').length;
      const visuals=items.filter(i=>i.category==='photos'||i.category==='arts').length;
      if(countEls.songs) countEls.songs.textContent=songs;
      if(countEls.visuals) countEls.visuals.textContent=visuals;
      if(countEls.total) countEls.total.textContent=items.length;
      render();
    }).catch(() => {
      grid.hidden=true; empty.hidden=false;
      empty.querySelector('strong').textContent='The library is taking a little break.';
      empty.querySelector('span').textContent='Try again in a moment.';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    homeStats();
    initLibraryPage();
  });
})();