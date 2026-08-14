let catalog = { tracks: [], folders: [] }
let filtered = []
let currentIndex = -1
let repeatMode = 'off'
let deferredPrompt = null
let displayLimit = 80

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const favKey = 'buddhadasa:favorites'
const lastKey = 'buddhadasa:last'
let audio = null

function favs() {
  return new Set(JSON.parse(localStorage.getItem(favKey) || '[]'))
}
function saveFavs(set) {
  localStorage.setItem(favKey, JSON.stringify([...set]))
}
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.mp3$/, '')
    .trim()
}
function currentTrack() {
  return catalog.tracks[currentIndex]
}
function canInline(t) {
  return Boolean(t?.audioUrl)
}
function mediaUrl(t) {
  return t?.audioUrl || t?.onedriveUrl || t?.webUrl || '#'
}
function sourceUrl(t) {
  return t?.onedriveUrl || t?.webUrl || mediaUrl(t)
}
function shareUrl(t) {
  const u = new URL(location.href)
  u.searchParams.set('track', t.id)
  return u.toString()
}
function absoluteMediaUrl(t) {
  return new URL(mediaUrl(t), location.href).href
}
function formatSize(t) {
  return [t.size, t.modified ? '• ' + t.modified : ''].filter(Boolean).join(' ')
}
function updateNowPlaying() {
  const t = currentTrack()
  $('#nowTitle').textContent = t ? `${t.episode ? t.episode + ' ' : ''}${t.title || t.fileName}` : 'ยังไม่ได้เลือกตอน'
  $('#nowMeta').textContent = t ? `${t.album || 'ไม่ระบุแผ่น'} • ${t.category || 'ไม่ระบุหมวด'}` : 'เลือกเสียงธรรมะเพื่อเปิดฟัง'
  $('#playbackHint').textContent = t
    ? canInline(t)
      ? 'ตอนนี้เล่นในหน้าเว็บได้โดยตรงค่ะ'
      : 'ตอนนี้จะเปิดผ่าน OneDrive preview เพื่อคงต้นทุน 0 บาทค่ะ'
    : 'เลือกตอนที่ต้องการฟังได้เลยค่ะ'
  updatePlayButton()
}
function updatePlayButton() {
  const t = currentTrack()
  $('#playBtn').textContent = t && canInline(t) && !audio.paused ? '❚❚' : '▶'
  $('#playBtn').title = t && canInline(t) && !audio.paused ? 'หยุดชั่วคราว' : 'เล่น'
}
async function load() {
  try {
    catalog = await fetch('./audio-index.json', { cache: 'no-store' }).then((r) => r.json())
  } catch (e) {
    catalog = { tracks: [], folders: [], error: String(e) }
  }
  init()
}
function init() {
  catalog.tracks = (catalog.tracks || []).map((t, i) => ({
    ...t,
    _i: i,
    search: norm([t.episode, t.title, t.fileName, t.album, t.category, t.path, t.source].join(' ')),
  }))
  filtered = [...catalog.tracks]
  $('#statTracks').textContent = catalog.tracks.length.toLocaleString('th-TH')
  $('#statAlbums').textContent = new Set(catalog.tracks.map((t) => t.album).filter(Boolean)).size.toLocaleString('th-TH')
  fillFilters()
  renderChips()
  bind()
  applyFilters()

  const qsId = new URL(location.href).searchParams.get('track')
  const remembered = localStorage.getItem(lastKey)
  const pickedId = qsId || remembered
  if (pickedId) {
    const i = catalog.tracks.findIndex((t) => t.id === pickedId)
    if (i >= 0) selectTrack(i, false)
  }
  updateNowPlaying()
}
function fillFilters() {
  for (const album of [...new Set(catalog.tracks.map((t) => t.album).filter(Boolean))]) {
    $('#albumFilter').insertAdjacentHTML('beforeend', `<option>${escapeHtml(album)}</option>`)
  }
  for (const category of [...new Set(catalog.tracks.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))) {
    $('#categoryFilter').insertAdjacentHTML('beforeend', `<option>${escapeHtml(category)}</option>`)
  }
}
function renderChips() {
  const cats = [...new Set(catalog.tracks.map((t) => t.category).filter(Boolean))].slice(0, 24)
  $('#chips').innerHTML = cats.map((c) => `<button class="chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')
}
function bind() {
  ['input', 'change'].forEach((ev) => {
    $('#searchInput').addEventListener(ev, applyFilters)
    $('#albumFilter').addEventListener(ev, applyFilters)
    $('#categoryFilter').addEventListener(ev, applyFilters)
  })
  audio = $('#audioEl')
  audio.preload = 'none'
  $('#clearBtn').onclick = () => {
    $('#searchInput').value = ''
    $('#albumFilter').value = ''
    $('#categoryFilter').value = ''
    applyFilters()
  }
  $('#shuffleBtn').onclick = shuffle
  $('#randomHero').onclick = shuffle
  $('#repeatBtn').onclick = () => {
    repeatMode = repeatMode === 'off' ? 'one' : repeatMode === 'one' ? 'all' : 'off'
    $('#repeatBtn').dataset.mode = repeatMode
    $('#repeatBtn').title = 'Repeat: ' + repeatMode
    $('#repeatBtn').setAttribute('aria-label', 'Repeat: ' + repeatMode)
  }
  $('#shareAppBtn').onclick = () => share({ title: document.title, url: location.href })
  $('#shareTrackBtn').onclick = () => {
    const t = currentTrack()
    if (t) share({ title: t.title || t.fileName, text: t.category, url: shareUrl(t) })
  }
  $('#openOneDrive').onclick = () => {
    const t = currentTrack()
    if (t) window.open(sourceUrl(t), '_blank', 'noopener')
  }
  $('#playBtn').onclick = toggleCurrentPlayback
  $('#prevBtn').onclick = () => move(-1)
  $('#nextBtn').onclick = () => move(1)
  $$('.tab').forEach((b) => (b.onclick = () => showView(b.dataset.view)))
  $('#chips').onclick = (e) => {
    const b = e.target.closest('.chip')
    if (!b) return
    $('#categoryFilter').value = b.dataset.cat
    applyFilters()
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    $('#installBtn').style.display = 'inline-flex'
  })
  $('#installBtn').onclick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      deferredPrompt = null
    } else {
      alert('บน iPhone: กด Share > Add to Home Screen\nบน Android: เมนู browser > Install app ค่ะ')
    }
  }

  audio.addEventListener('play', updatePlayButton)
  audio.addEventListener('pause', updatePlayButton)
  audio.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audio.currentTime = 0
      audio.play().catch(() => {})
      return
    }
    move(1, true)
  })
  audio.addEventListener('loadedmetadata', () => {
    const t = currentTrack()
    if (!t) return
    const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null
    if (duration && !t.duration) t.duration = duration
  })
}
function applyFilters() {
  displayLimit = 80
  const q = norm($('#searchInput').value)
  const a = $('#albumFilter').value
  const c = $('#categoryFilter').value
  filtered = catalog.tracks.filter((t) => (!q || t.search.includes(q)) && (!a || t.album === a) && (!c || t.category === c))
  renderList(filtered, $('#trackList'))
  $('#resultCount').textContent = `พบ ${filtered.length.toLocaleString('th-TH')} ตอน`
  renderFavs()
}
function renderList(list, el) {
  if (!list.length) {
    el.innerHTML = '<div class="track"><h3>ยังไม่พบรายการ</h3><p>ลองล้างตัวกรองหรือใช้คำค้นอื่นค่ะ</p></div>'
    return
  }
  const isMain = el.id === 'trackList'
  const visible = isMain ? list.slice(0, displayLimit) : list
  el.innerHTML =
    visible.map((t) => card(t)).join('') +
    (isMain && list.length > displayLimit
      ? `<button class="load-more" onclick="displayLimit+=80;renderList(filtered,document.querySelector('#trackList'))">โหลดเพิ่มอีก ${Math.min(80, list.length - displayLimit).toLocaleString('th-TH')} รายการ</button>`
      : '')
}
function card(t) {
  const f = favs().has(t.id)
  const playLabel = canInline(t) ? 'ฟังในเว็บ' : 'เปิดผ่าน OneDrive'
  const cloudUrl = sourceUrl(t)
  return `<article class="track">
    <div class="track-top">
      <div class="num">${escapeHtml(t.episode || 'ธรรม')}</div>
      <div>
        <h3>${escapeHtml(t.title || t.fileName)}</h3>
        <p>${escapeHtml(t.album || 'ไม่ระบุแผ่น')} • ${escapeHtml(t.category || 'ไม่ระบุหมวด')}</p>
        <p>${escapeHtml(formatSize(t))}</p>
      </div>
    </div>
    <div class="track-actions icon-actions">
      <button class="play" title="${playLabel}" aria-label="${playLabel}" onclick="selectTrack(${t._i},true)">${canInline(t) ? '🎧' : '▶'}</button>
      <button title="รายการโปรด" aria-label="รายการโปรด" onclick="toggleFav('${t.id}')">${f ? '♥' : '♡'}</button>
      <button title="แชร์" aria-label="แชร์" onclick="shareTrack('${t.id}')">📤</button>
      <a title="เปิดต้นทาง" aria-label="เปิดต้นทาง" href="${cloudUrl}" target="_blank" rel="noopener">☁️</a>
    </div>
  </article>`
}
function selectTrack(i, autoplay) {
  currentIndex = i
  const t = catalog.tracks[i]
  localStorage.setItem(lastKey, t.id)
  updateNowPlaying()
  if (autoplay) play(t)
}
function play(t) {
  selectTrack(t._i, false)
  if (canInline(t)) {
    const url = absoluteMediaUrl(t)
    if (audio.src !== url) audio.src = url
    audio.play().catch(() => {
      window.open(sourceUrl(t), '_blank', 'noopener')
    })
  } else {
    window.open(sourceUrl(t), '_blank', 'noopener')
  }
}
function toggleCurrentPlayback() {
  const t = currentTrack() || filtered[0]
  if (!t) return
  if (!canInline(t)) {
    play(t)
    return
  }
  selectTrack(t._i, false)
  const url = absoluteMediaUrl(t)
  if (audio.src !== url) audio.src = url
  if (audio.paused) audio.play().catch(() => {})
  else audio.pause()
}
function move(delta, autoplay = true) {
  if (!filtered.length) return
  const cur = filtered.findIndex((t) => t._i === currentIndex)
  let ni = cur < 0 ? 0 : cur + delta
  if (ni < 0) ni = repeatMode === 'all' ? filtered.length - 1 : 0
  if (ni >= filtered.length) ni = repeatMode === 'all' ? 0 : filtered.length - 1
  selectTrack(filtered[ni]._i, autoplay)
}
function shuffle() {
  if (!filtered.length) return
  const t = filtered[Math.floor(Math.random() * filtered.length)]
  selectTrack(t._i, true)
}
window.toggleFav = (id) => {
  const s = favs()
  s.has(id) ? s.delete(id) : s.add(id)
  saveFavs(s)
  renderList(filtered, $('#trackList'))
  renderFavs()
}
function renderFavs() {
  const s = favs()
  renderList(catalog.tracks.filter((t) => s.has(t.id)), $('#favoriteList'))
}
window.shareTrack = (id) => {
  const t = catalog.tracks.find((x) => x.id === id)
  if (t) share({ title: t.title || t.fileName, text: t.category, url: shareUrl(t) })
}
async function share(data) {
  if (navigator.share) await navigator.share(data).catch(() => {})
  else {
    await navigator.clipboard.writeText(data.url)
    alert('คัดลอกลิงก์แล้วค่ะ')
  }
}
function showView(id) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === id))
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === id))
}
function escapeHtml(s) {
  return (s ?? '').toString().replace(/[&<>\"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]))
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {})
load()
