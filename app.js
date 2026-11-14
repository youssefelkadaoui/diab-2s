import { ROLES, UNIQUE_ROLE_IDS } from './roles.js';

// ضع بيانات مشروع Supabase هنا (Project Settings → API). لا تضع service_role key في الواجهة.
const SUPABASE_URL = 'https://mqzoqmcltufkoaclmuji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xem9xbWNsdHVma29hY2xtdWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MTkyMTksImV4cCI6MjExMDA5NTIxOX0.MhoflYs1blJ2epvNNwdoP_SE030_kl7GLDUNKBOnq3k';
const TABLE = 'werewolf_rooms';
const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const client = window.supabase && SUPABASE_URL.includes('https://') && !SUPABASE_URL.includes('YOUR_PROJECT')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const params = new URLSearchParams(location.search);
const saved = (() => { try { return JSON.parse(localStorage.getItem('laylat-session') || '{}'); } catch { return {}; } })();
const session = { roomId: params.get('room')?.toUpperCase() || saved.roomId || '', playerId: saved.playerId || crypto.randomUUID(), playerName: saved.playerName || '', isHost: !!saved.isHost };
let state = null, channel = null, toastTimer = null, heartbeatTimer = null, dealAudio = null, deferredInstallPrompt = null;

function isInstalledApp() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function showInstallChoice() {
  if (isInstalledApp() || sessionStorage.getItem('install-choice-dismissed')) return;
  const dialog = $('#install-dialog');
  if (dialog) dialog.hidden = false;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  $('#install-dialog').hidden = true;
  sessionStorage.setItem('install-choice-dismissed', 'yes');
  notify('تم تثبيت ليلة الذئاب على هاتفك.');
});
$('#play-now').onclick = () => { $('#install-dialog').hidden = true; sessionStorage.setItem('install-choice-dismissed', 'yes'); };
$('#install-now').onclick = async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#install-dialog').hidden = true;
    sessionStorage.setItem('install-choice-dismissed', 'yes');
    return;
  }
  const description = $('#install-description');
  const button = $('#install-now');
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    description.textContent = 'في Safari اضغط زر المشاركة، ثم اختر «إضافة إلى الشاشة الرئيسية». لا يحتاج ذلك إلى فتح الإعدادات.';
  } else {
    description.textContent = 'إذا لم يظهر طلب التثبيت، افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
  }
  button.textContent = 'حسناً';
  button.onclick = () => { $('#install-dialog').hidden = true; sessionStorage.setItem('install-choice-dismissed', 'yes'); };
};

document.addEventListener('copy', event => { event.preventDefault(); notify('النسخ غير متاح داخل اللعبة.'); });
document.addEventListener('cut', event => { event.preventDefault(); notify('القص غير متاح داخل اللعبة.'); });
document.addEventListener('contextmenu', event => {
  if (!event.target.closest('input, textarea, [contenteditable="true"]')) event.preventDefault();
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && ['c', 'x'].includes(event.key.toLowerCase())) event.preventDefault();
});
function persist() { localStorage.setItem('laylat-session', JSON.stringify(session)); }
function notify(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 6000); }
function setConnection(online, label = online ? 'متصل' : 'غير متصل') { $('#connection').classList.toggle('online', online); $('#connection').innerHTML = `<i></i> ${label}`; }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function makeCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
function initialState(code, host) {
  return { id: code, hostId: session.playerId, hostMode: host ? 'narrator' : 'player', phase: 'lobby', players: [{ id: session.playerId, name: session.playerName, connected: true, role: null, alive: true, protected: false, lovers: false }], deck: { werewolf: 1, villager: 0, seer: false, witch: false, hunter: false, cupid: false, guard: false, little_girl: false, traitor: false }, witchPotions: { life: true, poison: true }, createdAt: Date.now(), round: 0 };
}
function myPlayer() { return state?.players.find(player => player.id === session.playerId); }
function connectedPlayers() { return (state?.players || []).filter(player => player.connected !== false && (!player.lastSeen || Date.now() - player.lastSeen < 45000)); }
function isNarrator() { return state && state.hostId === session.playerId && state.hostMode === 'narrator'; }
function roleCount(deck = state.deck) { return Number(deck.werewolf || 0) + Number(deck.villager || 0) + UNIQUE_ROLE_IDS.filter(id => deck[id]).length; }
function playDealAudioAt(timestamp = Date.now()) {
  dealAudio ||= new Audio('./deal-audio.mp4');
  const delay = Math.max(0, timestamp - Date.now());
  const play = () => {
    dealAudio.currentTime = 0;
    dealAudio.play().catch(error => console.warn('Audio could not be played:', error));
  };
  if (delay === 0) play(); else setTimeout(play, delay);
}

async function ensureSupabase() {
  if (!client) { setConnection(false, 'أضف إعدادات Supabase'); return false; }
  setConnection(false, 'جارٍ الاتصال');
  return true;
}
async function loadRoom(code) {
  if (!await ensureSupabase()) return;
  try {
    const { data, error } = await client.from(TABLE).select('id,state').eq('id', code).maybeSingle();
    if (error) throw error;
    if (!data) { notify('لم نعثر على هذه الغرفة. تحقق من الرمز.'); renderHome(code); return; }
    state = data.state;
    if (!session.playerName) session.playerName = state.players.find(p => p.id === session.playerId)?.name || '';
    const known = state.players.some(p => p.id === session.playerId);
    if (!known && state.phase !== 'lobby') { notify('بدأت هذه الجولة بالفعل. اطلب من المضيف إنشاء جولة جديدة.'); renderHome(code); return; }
    if (!known) { state.players.push({ id: session.playerId, name: session.playerName || 'لاعب جديد', connected: true, lastSeen: Date.now(), role: null, alive: true, protected: false, lovers: false }); await saveState(); }
    else { const p = myPlayer(); p.connected = true; p.lastSeen = Date.now(); await saveState(); }
    session.roomId = code; persist(); subscribe(code); startHeartbeat(); render();
  } catch (error) { console.error(error); notify('تعذّر الوصول للغرفة. تأكد من إعداد Supabase والجدول.'); renderHome(code); }
}
async function saveState() {
  if (!state || !client) return;
  const { error } = await client.from(TABLE).upsert({ id: state.id, state, updated_at: new Date().toISOString() });
  if (error) { console.error(error); notify('تعذّرت مزامنة التغييرات.'); }
}
function startHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    if (!state || !session.roomId) return;
    const player = myPlayer();
    if (!player) return;
    player.connected = true; player.lastSeen = Date.now();
    await saveState();
  }, 15000);
}
function subscribe(code) {
  if (channel) client.removeChannel(channel);
  channel = client.channel(`room-${code}`).on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${code}` }, payload => {
    if (payload.new?.state) {
      const wasLobby = state?.phase === 'lobby';
      state = payload.new.state;
      if (wasLobby && state.phase === 'game' && state.soundAt) playDealAudioAt(state.soundAt);
      render();
    }
  }).subscribe(status => { setConnection(status === 'SUBSCRIBED'); });
}
async function createRoom(name, hostMode) {
  if (!await ensureSupabase()) { notify('أضف إعدادات Supabase في app.js أولاً.'); return; }
  session.playerName = name.trim(); session.isHost = true; persist();
  for (let tries = 0; tries < 5; tries++) {
    const code = makeCode(); state = initialState(code, hostMode === 'narrator');
    state.players[0].lastSeen = Date.now();
    state.hostMode = hostMode;
    let result;
    try { result = await client.from(TABLE).insert({ id: code, state, updated_at: new Date().toISOString() }); }
    catch (error) { console.error('Supabase create room failed:', error); notify('تعذّر الاتصال بـ Supabase. تحقق من رابط المشروع والإنترنت.'); return; }
    const { error } = result;
    if (!error) { session.roomId = code; persist(); subscribe(code); startHeartbeat(); render(); return; }
    if (error.code !== '23505') {
      console.error('Supabase create room error:', error);
      const code = error.code || '';
      if (code === '42P01' || code === 'PGRST205') notify('جدول الغرف غير موجود. نفّذ ملف supabase-schema.sql في SQL Editor داخل مشروع Supabase.');
      else if (code === '42501' || code === '401' || code === '403') notify('Supabase رفض الكتابة. نفّذ ملف SQL لإنشاء صلاحيات وسياسات الجدول.');
      else if (code === 'PGRST204' || code === 'PGRST202') notify('تعذّر العثور على إعداد الجدول. تأكد من تشغيل ملف SQL ثم أعد المحاولة.');
      else notify(`تعذّر إنشاء الغرفة (${code || 'خطأ اتصال'}): ${error.message || 'تحقق من إعدادات Supabase.'}`);
      return;
    }
  }
  notify('تعذّر إيجاد رمز غرفة متاح. حاول مجدداً.');
}
async function joinRoom(code, name) {
  if (!code || code.length !== 4) { notify('أدخل رمز غرفة من 4 خانات.'); return; }
  session.playerName = name.trim(); session.playerId = saved.playerId || crypto.randomUUID(); persist();
  await loadRoom(code.toUpperCase());
}

function renderHome(room = '') {
  state = null; session.roomId = ''; persist();
  app.innerHTML = `<section class="hero"><div class="eyebrow"><span class="eyebrow-line"></span> ليلة واحدة تغيّر كل شيء <span class="eyebrow-line"></span></div><div class="moon">☾</div><h1>هل تثق بمن <em>يجلس بجانبك؟</em></h1><p class="hero-copy">اجمع أصدقاءك، وزّع الأدوار سراً، واكتشف من يختبئ بينكم قبل طلوع الفجر.</p></section>
  <section class="panel home-panel"><div class="panel-heading"><div><span class="step">01 / البداية</span><h2>ادخل إلى القرية</h2></div><span class="heading-icon">✦</span></div>
    <label class="field-label" for="player-name">اسمك في اللعبة</label><div class="input-wrap"><span>♙</span><input id="player-name" maxlength="24" placeholder="كيف يناديك أهل القرية؟" value="${escapeHtml(session.playerName)}" autocomplete="nickname"></div>
    <button id="create-room" class="button button-primary full"><span>إنشاء غرفة جديدة</span><span>↙</span></button>
    <div class="divider"><span>أو انضم إلى غرفة</span></div><label class="field-label" for="room-code">رمز الغرفة</label><div class="join-row"><input id="room-code" class="code-input" maxlength="4" placeholder="مثال: L7Q2" value="${escapeHtml(room)}" autocomplete="off" dir="ltr"><button id="join-room" class="button button-quiet">انضمام <span>←</span></button></div>
    <p class="secure-note"><span>◈</span> أدوارك سرية — لا تكشف بطاقتك لأحد</p>
  </section><p class="home-footnote">٢–١٨ لاعباً <span>·</span> الأفضل مع ٦ لاعبين أو أكثر</p>`;
  $('#create-room').onclick = () => { const name = $('#player-name').value.trim(); if (!name) return notify('اكتب اسمك أولاً.'); openHostChoice(name); };
  $('#join-room').onclick = () => { const name = $('#player-name').value.trim(); if (!name) return notify('اكتب اسمك أولاً.'); joinRoom($('#room-code').value.trim(), name); };
  $('#room-code').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); };
  $('#room-code').onkeydown = e => { if (e.key === 'Enter') $('#join-room').click(); };
}
function openHostChoice(name) {
  app.innerHTML = `<section class="panel setup-choice"><button class="back-link" id="back-home">→ رجوع</button><span class="step">قبل أن تبدأ</span><h1>كيف تريد أن تلعب؟</h1><p class="muted">اختر دورك في هذه الجولة. يمكنك تغيير الاختيار في جولة جديدة.</p><button class="choice-card" data-mode="narrator"><span class="choice-icon">🎙️</span><span><b>راوٍ مشرف</b><small>تدير الليل والنهار ولا تأخذ بطاقة.</small></span><span class="choice-arrow">←</span></button><button class="choice-card" data-mode="player"><span class="choice-icon">🃏</span><span><b>لاعب عادي</b><small>تأخذ بطاقة وتلعب مع أهل القرية.</small></span><span class="choice-arrow">←</span></button></section>`;
  $('#back-home').onclick = () => renderHome();
  app.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => createRoom(name, button.dataset.mode));
}

function render() {
  if (!state) return renderHome();
  if (state.phase === 'lobby') return renderLobby();
  if (state.phase === 'ended') return renderEnded();
  if (isNarrator()) return renderNarrator();
  return renderCard();
}
function renderLobby() {
  const people = connectedPlayers(), count = roleCount(), required = people.length - (state.hostMode === 'narrator' ? 1 : 0), ready = required > 0 && count === required;
  const waitingForNarratedPlayers = state.hostMode === 'narrator' && required === 0;
  const deck = state.deck;
  app.innerHTML = `<section class="room-top"><button class="back-link" id="leave">← خروج</button><span class="room-label">غرفة خاصة <span class="live-dot"></span></span></section>
  <section class="panel room-panel"><div class="room-code-block"><div><span class="step">رمز الدعوة</span><div class="room-code" dir="ltr">${state.id}</div></div><button id="share-link" class="icon-button" aria-label="مشاركة رابط الدعوة">↗</button></div><button id="share-text" class="button button-outline full">مشاركة رابط الدعوة <span>↗</span></button>
  <div class="player-header"><div><span class="step">في انتظار اكتمال المجموعة</span><h2>أهل القرية <span class="player-count">${people.length}</span></h2></div><span class="players-symbol">♙</span></div><div class="player-list">${people.map((p, i) => `<div class="player-row"><span class="avatar ${p.id === state.hostId ? 'host-avatar' : ''}">${escapeHtml((p.name || '?').trim().charAt(0))}</span><span class="player-name">${escapeHtml(p.name)}${p.id === session.playerId ? ' <small>(أنت)</small>' : ''}</span>${p.id === state.hostId ? '<span class="host-tag">المضيف</span>' : ''}<span class="ready-dot"></span></div>`).join('')}</div>
  ${session.playerId === state.hostId ? `<div class="deck-head"><span class="step">تشكيلة الجولة</span><span class="deck-total ${ready ? 'matched' : ''}">${count} <small>${waitingForNarratedPlayers ? 'بطاقة · بانتظار اللاعبين' : `/ ${required} بطاقة`}</small></span></div><div class="role-config">${roleControl('werewolf', deck.werewolf, 'counter')}${roleControl('villager', deck.villager, 'counter')}${UNIQUE_ROLE_IDS.map(id => roleControl(id, deck[id], 'toggle')).join('')}</div><p class="match-hint ${ready ? 'hint-ready' : ''}">${waitingForNarratedPlayers ? 'الغرفة جاهزة؛ شارك رابط الدعوة. الراوي لا يأخذ بطاقة.' : ready ? '✓ التشكيلة تطابق عدد اللاعبين' : count > required ? 'قلّل البطاقات أو أضف لاعباً' : `اختر ${required - count} بطاقة إضافية`}</p><button id="start-game" class="button button-primary full start-button" ${ready ? '' : 'disabled'}>توزيع البطاقات <span>✦</span></button>` : `<div class="waiting"><span class="spinner"></span> المضيف يجهّز التشكيلة…</div>`}
  </section><p class="home-footnote">${state.hostMode === 'narrator' ? 'أنت تلعب دور الراوي' : 'أنت تلعب مع المجموعة'} <span>·</span> لا تغلق الصفحة أثناء التوزيع</p>`;
  $('#leave').onclick = leaveRoom; $('#share-link').onclick = shareInvite; $('#share-text').onclick = shareInvite;
  if (session.playerId === state.hostId) {
    app.querySelectorAll('[data-role-action]').forEach(button => button.onclick = () => changeDeck(button.dataset.roleAction, button.dataset.kind === 'counter' ? Number(button.dataset.delta) : null));
    $('#start-game').onclick = distribute;
  }
}
function roleControl(id, value, kind) {
  const role = ROLES[id];
  if (kind === 'counter') return `<div class="role-line"><span class="role-emoji">${role.icon}</span><span class="role-title">${role.name}</span><div class="counter"><button data-role-action="${id}" data-kind="counter" data-delta="-1" aria-label="تقليل ${role.name}">−</button><b>${Number(value) || 0}</b><button data-role-action="${id}" data-kind="counter" data-delta="1" aria-label="زيادة ${role.name}">+</button></div></div>`;
  return `<button class="role-line unique-role ${value ? 'role-active' : ''}" data-role-action="${id}" data-kind="toggle" aria-pressed="${!!value}"><span class="role-emoji">${role.icon}</span><span class="role-title">${role.name}</span><span class="toggle ${value ? 'on' : ''}"><i></i></span></button>`;
}
async function changeDeck(id, delta) {
  if (delta === null) state.deck[id] = !state.deck[id]; else state.deck[id] = Math.max(0, Math.min(id === 'werewolf' ? 10 : 18, Number(state.deck[id]) + delta));
  await saveState(); renderLobby();
}
function secureRandomInt(max) {
  const range = 0x100000000;
  const limit = range - (range % max);
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % max;
}
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
async function distribute() {
  if (session.playerId !== state.hostId) return;
  const players = connectedPlayers().filter(p => !(state.hostMode === 'narrator' && p.id === state.hostId));
  if (players.length !== roleCount()) return notify('عدد البطاقات لا يطابق عدد اللاعبين.');
  const deck = [];
  for (let i = 0; i < state.deck.werewolf; i++) deck.push('werewolf');
  for (let i = 0; i < state.deck.villager; i++) deck.push('villager');
  UNIQUE_ROLE_IDS.forEach(id => { if (state.deck[id]) deck.push(id); });
  // Generate a fresh secure shuffle of roles and player order for every deal.
  shuffle(deck);
  shuffle(players).forEach((player, i) => { player.role = deck[i]; player.alive = true; player.protected = false; player.lovers = false; });
  state.phase = 'game'; state.round++; state.soundAt = Date.now(); state.witchPotions = { life: true, poison: true }; state.players.filter(p => !players.some(player => player.id === p.id)).forEach(p => { p.role = null; });
  playDealAudioAt(state.soundAt);
  render();
  await saveState();
}

function renderCard() {
  const player = myPlayer();
  if (!player || !player.role) { app.innerHTML = `<section class="panel waiting-panel"><span class="spinner"></span><h2>البطاقات تُخلط…</h2><p class="muted">سيظهر دورك هنا بعد التوزيع.</p></section>`; return; }
  const role = ROLES[player.role];
  app.innerHTML = `<section class="game-head"><div><span class="step">غرفة ${state.id} <span>·</span> الجولة ${state.round}</span><h1>بطاقتك السرية</h1></div><span class="night-moon">☾</span></section><p class="reveal-instruction">اضغط على البطاقة لعرض دورك، واضغط مجدداً لإخفائه</p><div class="card-scene"><button class="role-card" id="role-card" aria-label="اضغط لعرض بطاقتك أو إخفائها"><span class="card-face card-back"><span class="card-back-moon">☾</span><span class="card-back-logo">ليلة<br><b>الذئاب</b></span><span class="card-back-runes">✦　☽　✦</span><span class="card-back-hint">اضغط لعرض البطاقة</span></span><span class="card-face card-front ${role.team === 'wolves' ? 'wolves' : ''}"><span class="card-top-label">دورك في القرية</span><span class="role-image-frame"><img class="role-image" src="${role.image}" alt="${role.name}"></span><b class="role-name">${role.name}</b><span class="team-badge ${role.team}">${role.teamName}</span><span class="role-description">${role.description}</span></span></button></div><div class="card-status"><span class="status-orb"></span><span>بطاقتك مرئية لك وحدك</span></div>${session.playerId === state.hostId ? '<button id="end-game" class="button button-danger full">إنهاء اللعبة <span>■</span></button>' : ''}<p class="privacy-foot">تأكد أن من حولك لا يرون الشاشة قبل الكشف.</p>`;
  const card = $('#role-card');
  card.setAttribute('aria-label', 'اضغط لعرض بطاقتك أو إخفائها');
  card.setAttribute('aria-pressed', 'false');
  card.addEventListener('click', () => {
    const revealed = card.classList.toggle('revealed');
    card.setAttribute('aria-pressed', String(revealed));
  });
  card.addEventListener('contextmenu', e => e.preventDefault());
  if (session.playerId === state.hostId) $('#end-game').onclick = endGame;
}
function renderNarrator() {
  const people = state.players.filter(player => player.role);
  const activeRoles = [...new Set(people.map(p => p.role))].filter(id => ROLES[id].night).sort((a,b) => ['cupid','werewolf','seer','guard','witch'].indexOf(a) - ['cupid','werewolf','seer','guard','witch'].indexOf(b));
  app.innerHTML = `<section class="game-head"><div><span class="step">لوحة الراوي <span>·</span> الجولة ${state.round}</span><h1>أسرار القرية</h1></div><span class="night-moon">☾</span></section><section class="panel narrator-panel"><div class="narrator-summary"><span>عدد اللاعبين</span><b>${people.length}</b><span class="summary-separator"></span><span>الناجون</span><b>${people.filter(p=>p.alive).length}</b></div>
  <div class="section-title"><span class="step">تسلسل الليل</span><small>نادِ الأدوار بالترتيب</small></div><div class="night-order">${activeRoles.length ? activeRoles.map((id,i)=>`<div class="night-step"><span class="order-number">${String(i+1).padStart(2,'0')}</span><span class="role-emoji">${ROLES[id].icon}</span><span>${ROLES[id].night}</span></div>`).join('') : '<p class="muted">لا توجد أدوار ليلية مختارة.</p>'}</div>
  <div class="section-title players-title"><span class="step">اللاعبون والأدوار</span><small>تظهر لك أنت فقط</small></div><div class="narrator-players">${people.map(p=>`<div class="narrator-player ${p.alive ? '' : 'dead'}"><span class="avatar ${ROLES[p.role].team}">${ROLES[p.role].icon}</span><span class="n-player-name">${escapeHtml(p.name)}<small>${ROLES[p.role].name}</small></span><div class="player-state"><button data-player="${p.id}" data-state="alive" class="state-chip ${p.alive ? 'selected' : ''}">حي</button><button data-player="${p.id}" data-state="dead" class="state-chip ${!p.alive ? 'selected' : ''}">ميت</button><button data-player="${p.id}" data-state="protected" class="state-chip ${p.protected ? 'protected' : ''}">محمي</button><button data-player="${p.id}" data-state="lovers" class="state-chip ${p.lovers ? 'lovers' : ''}">♥</button></div></div>`).join('')}</div>
  ${people.some(p=>p.role==='witch') ? `<div class="potion-box"><span class="step">جرعات الساحرة</span><div class="potion-controls"><button data-potion="life" class="potion ${state.witchPotions.life ? 'available' : ''}">♥ جرعة الحياة <b>${state.witchPotions.life ? 'متاحة' : 'استُخدمت'}</b></button><button data-potion="poison" class="potion ${state.witchPotions.poison ? 'available' : ''}">☠ جرعة السم <b>${state.witchPotions.poison ? 'متاحة' : 'استُخدمت'}</b></button></div></div>` : ''}
  <button id="new-round" class="button button-outline full">جولة جديدة · إعادة توزيع البطاقات <span>↻</span></button><button id="end-game" class="button button-danger full">إنهاء اللعبة <span>■</span></button></section><p class="privacy-foot">لا تعرض هذه الشاشة على اللاعبين.</p>`;
  app.querySelectorAll('[data-player]').forEach(button => button.onclick = async () => { const player = state.players.find(p => p.id === button.dataset.player); const value = button.dataset.state; if(value==='alive') player.alive=true; if(value==='dead') player.alive=false; if(value==='protected') player.protected=!player.protected; if(value==='lovers') player.lovers=!player.lovers; await saveState(); renderNarrator(); });
  app.querySelectorAll('[data-potion]').forEach(button => button.onclick = async () => { const key=button.dataset.potion; state.witchPotions[key]=!state.witchPotions[key]; await saveState(); renderNarrator(); });
  $('#new-round').onclick = async () => { if(!confirm('إعادة توزيع البطاقات وبدء جولة جديدة؟')) return; state.players.forEach(p=>{p.role=null;p.alive=true;p.protected=false;p.lovers=false;}); state.phase='lobby'; state.soundAt=null; state.witchPotions={life:true,poison:true}; await saveState(); renderLobby(); };
  $('#end-game').onclick = endGame;
}
async function endGame() {
  if (session.playerId !== state?.hostId) return;
  if (!confirm('هل تريد إنهاء اللعبة لجميع اللاعبين؟')) return;
  state.phase = 'ended'; state.endedAt = Date.now();
  await saveState(); renderEnded();
}
function renderEnded() {
  const players = state.players.filter(player => player.role);
  app.innerHTML = `<section class="game-head"><div><span class="step">انتهت الجولة ${state.round}</span><h1>انكشف سرّ القرية</h1></div><span class="night-moon">☾</span></section><section class="panel ended-panel"><p class="ended-intro">${session.playerId === state.hostId ? 'أنهيت اللعبة. هذه أدوار أهل القرية:' : 'أنهى المضيف اللعبة. هذه أدوار أهل القرية:'}</p><div class="ended-players">${players.map(player=>{const role=ROLES[player.role];return `<div class="ended-player"><span class="role-emoji">${role.icon}</span><span>${escapeHtml(player.name)}</span><b class="team-badge ${role.team}">${role.name}</b></div>`;}).join('')}</div>${session.playerId === state.hostId ? '<button id="back-to-room" class="button button-primary full">العودة إلى الغرفة <span>↻</span></button>' : '<p class="waiting">بانتظار المضيف لبدء جولة جديدة…</p>'}</section>`;
  if (session.playerId === state.hostId) $('#back-to-room').onclick = async () => {
    state.players.forEach(player=>{player.role=null;player.alive=true;player.protected=false;player.lovers=false;});
    state.phase='lobby'; state.soundAt=null; state.witchPotions={life:true,poison:true};
    await saveState(); renderLobby();
  };
}
async function shareInvite() {
  const url = `${location.origin}${location.pathname}?room=${state.id}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'دعوة إلى ليلة الذئاب', text: 'انضم إلى غرفة لعبة المستذئبون', url }); }
    catch (error) { if (error.name !== 'AbortError') notify('تعذّرت مشاركة الرابط من هذا الجهاز.'); }
  } else prompt('أرسل رابط الدعوة للاعبين:', url);
}
async function leaveRoom() { clearInterval(heartbeatTimer); if (state) { const p=myPlayer(); if(p) { p.connected=false; p.lastSeen=0; } await saveState(); } if(channel) client?.removeChannel(channel); state=null; session.roomId=''; session.isHost=false; persist(); renderHome(); }

async function init() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(console.warn);
  }
  setTimeout(showInstallChoice, 800);
  if (!client) { renderHome(session.roomId); setConnection(false, 'أضف إعدادات Supabase'); return; }
  if (session.roomId) { session.playerName = session.playerName || ''; if (!session.playerName) { renderHome(session.roomId); notify('اكتب اسمك للانضمام إلى الغرفة.'); } else loadRoom(session.roomId); }
  else renderHome();
}
init();
