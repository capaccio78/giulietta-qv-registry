(() => {
  const PROJECT_URL = 'https://dvckgcjjyfvqwvvyxlob.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_Yn2w4SFIUnFw2sE-1-BSjA_9d3jTJ2u';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro = (n) => n == null || n === '' ? '—' : new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n));

  let client = null;
  let session = null;
  let claims = [];
  let vehicleOptions = [];
  let extras = new Map();
  let openCarBase = window.openCar;

  const guestPanel = $('#authGuest');
  const memberPanel = $('#authMember');
  const vehiclePanel = $('#vehicleMember');
  const claimsPanel = $('#claimsMember');
  const authStatus = $('#authStatus');
  const authMessage = $('#authMessage');
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');
  const profileForm = $('#profileForm');
  const vehicleForm = $('#vehicleForm');
  const claimSelect = $('#claimNumber');
  const numberAvailability = $('#numberAvailability');
  const claimsList = $('#claimsList');
  const logoutBtn = $('#logoutBtn');
  const resendSignup = $('#resendSignup');
  const loginPane = $('#loginPane');
  const registerPane = $('#registerPane');
  const resetPane = $('#resetPane');
  const showResetPassword = $('#showResetPassword');
  const backToLogin = $('#backToLogin');
  const resetPasswordForm = $('#resetPasswordForm');
  const changePasswordForm = $('#changePasswordForm');
  const currentPasswordLabel = $('#currentPasswordLabel');
  const passwordMessage = $('#passwordMessage');
  const captchaMount = $('#captchaMount');
  const TURNSTILE_SITE_KEY = '';
  let captchaToken = null;
  let recoveryMode = false;
  const passwordSubmit = changePasswordForm?.querySelector('button[type="submit"]');
  const currentPasswordInput = changePasswordForm?.querySelector('[name="current_password"]');

  function setRecoveryMode(active) {
    recoveryMode = !!active;
    if (currentPasswordLabel) {
      currentPasswordLabel.hidden = recoveryMode;
      currentPasswordLabel.style.display = recoveryMode ? 'none' : '';
    }
    if (currentPasswordInput) {
      currentPasswordInput.required = !recoveryMode;
      if (recoveryMode) currentPasswordInput.value = '';
    }
    if (passwordSubmit) passwordSubmit.textContent = recoveryMode ? 'Imposta nuova password' : 'Aggiorna password';
    if (passwordMessage && recoveryMode) {
      passwordMessage.textContent = 'Inserisci e conferma la nuova password.';
      passwordMessage.className = 'auth-message success';
    }
  }
  const authStartedAt = Date.now();
  const recoveryUrlSeen = () => {
    const raw = location.href;
    return /(?:[?#&])type=recovery(?:&|$)/.test(raw) || /(?:[?#&])code=/.test(raw) && sessionStorage.getItem('qv-password-recovery') === '1';
  };
  const openedFromRecoveryLink = /(?:[?#&])type=recovery(?:&|$)/.test(location.href);
  if (openedFromRecoveryLink) sessionStorage.setItem('qv-password-recovery','1');

  function message(text, type='') {
    if (!authMessage) return;
    authMessage.textContent = text || '';
    authMessage.className = 'auth-message' + (type ? ' ' + type : '');
  }

  function setTab(mode) {
    $$('.auth-tab').forEach(b => {
      const active = b.dataset.mode === mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (loginPane) loginPane.hidden = mode !== 'login';
    if (registerPane) registerPane.hidden = mode !== 'register';
    if (resetPane) resetPane.hidden = true;
    if (resendSignup) resendSignup.hidden = mode !== 'register';
    message('');
  }

  function showResetPane() {
    if (loginPane) loginPane.hidden = true;
    if (registerPane) registerPane.hidden = true;
    if (resetPane) resetPane.hidden = false;
    $$('.auth-tab').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-selected','false');
    });
    if (resendSignup) resendSignup.hidden = true;
    message('');
  }

  function botTrapTriggered(fd) {
    return !!String(fd.get('website') || '').trim() || (Date.now() - authStartedAt < 1200);
  }

  function resetCaptcha() {
    captchaToken = null;
    if (window.turnstile && captchaMount?.dataset.widgetId) {
      try { window.turnstile.reset(captchaMount.dataset.widgetId); } catch (_) {}
    }
  }

  function renderCaptcha() {
    if (!TURNSTILE_SITE_KEY || !captchaMount || !window.turnstile) return;
    captchaMount.hidden = false;
    const id = window.turnstile.render(captchaMount, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'dark',
      callback: token => { captchaToken = token; },
      'expired-callback': () => { captchaToken = null; }
    });
    captchaMount.dataset.widgetId = id;
  }

  $$('.auth-tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.mode)));
  showResetPassword?.addEventListener('click', showResetPane);
  backToLogin?.addEventListener('click', () => setTab('login'));
  $$('.login-link, .header-btn').forEach(a => {
    a.addEventListener('click', () => {
      if (session) return;
      setTab(a.classList.contains('header-btn') ? 'register' : 'login');
    });
  });

  function setAuthUi() {
    const signed = !!session?.user;
    if (guestPanel) guestPanel.hidden = signed;
    if (memberPanel) memberPanel.hidden = !signed;
    if (vehiclePanel) vehiclePanel.hidden = !signed;
    if (claimsPanel) claimsPanel.hidden = !signed;
    if (authStatus) {
      authStatus.textContent = signed ? 'Utente registrato' : 'Non autenticato';
      authStatus.classList.toggle('is-auth', signed);
    }
    const login = $('.login-link');
    const register = $('.header-btn');
    if (login) {
      login.textContent = signed ? 'Area riservata' : 'Accedi';
      login.href = '#account';
    }
    if (register) {
      register.textContent = signed ? 'Profilo' : 'Registrati';
      register.href = '#account';
    }
    const accountEmail = $('#accountEmail');
    if (accountEmail) accountEmail.textContent = signed ? (session.user.email || '') : '';
  }

  async function loadVehicleOptions() {
    const { data, error } = await client.from('registry_vehicles')
      .select('launch_number,color,country,city,latitude,longitude')
      .eq('identified', true)
      .order('launch_number');
    if (error) throw error;
    vehicleOptions = data || [];
  }

  function numberState(number) {
    const n = Number(number);
    if (!Number.isInteger(n) || n < 1 || n > 999) return {valid:false,taken:false};
    const vehicle = vehicleOptions.find(v => Number(v.launch_number) === n);
    const own = claims.find(x => Number(x.launch_number) === n);
    return {valid:true,taken:!!vehicle,vehicle,own};
  }

  function updateNumberAvailability() {
    if (!claimSelect || !numberAvailability) return;
    const s = numberState(claimSelect.value);
    if (!claimSelect.value) {
      numberAvailability.textContent = 'Inserisci un numero da 1 a 999.';
      return;
    }
    if (!s.valid) {
      numberAvailability.textContent = 'Numero non valido: inserisci un valore da 1 a 999.';
      return;
    }
    if (s.own) {
      numberAvailability.textContent = 'Hai già una richiesta per questo numero. Puoi aggiornarla qui.';
    } else if (s.taken) {
      numberAvailability.textContent = 'Numero già presente nel registro. Puoi rivendicarlo allegando una fonte/prova della proprietà.';
    } else {
      numberAvailability.textContent = 'Numero libero nel registro: puoi inviare la richiesta.';
    }
  }

  claimSelect?.addEventListener('input', () => {
    updateNumberAvailability();
    fillClaimForm(Number(claimSelect.value));
  });

  async function loadExtras() {
    let data = [];
    if (session?.user) {
      const r = await client.rpc('registry_extras_member');
      if (!r.error) data = r.data || [];
    } else {
      const r = await client.rpc('registry_extras_public');
      if (!r.error) data = r.data || [];
    }
    extras = new Map(data.map(x => [Number(x.launch_number), x]));
    decorateCards();
  }

  function visibleExtraLines(x) {
    if (!x) return [];
    const out = [];
    if (x.plate) out.push(['Targa', x.plate]);
    if (x.estimated_value_eur != null) out.push(['Valore indicativo', euro(x.estimated_value_eur) + (x.value_as_of ? ' · '+new Date(x.value_as_of+'T00:00:00').toLocaleDateString('it-IT') : '')]);
    if (x.contact_address) out.push(['Contatto volontario', x.contact_address]);
    if (x.contact_email) out.push(['Email proprietario', x.contact_email]);
    return out;
  }

  function decorateCards() {
    const grid = $('#grid');
    if (!grid) return;
    $$('.card', grid).forEach(card => {
      const n = Number(($('.num', card)?.textContent || '').replace(/\D/g,''));
      card.querySelector('.registry-extra')?.remove();
      const x = extras.get(n);
      if (!x) return;
      const lines = visibleExtraLines(x).filter(([k]) => k !== 'Email proprietario');
      if (!lines.length && !session) {
        const box = document.createElement('div');
        box.className = 'registry-extra';
        box.innerHTML = '<strong>Dati proprietario verificato</strong><div class="members-only">Accedi per i dati condivisi con i membri.</div>';
        card.appendChild(box);
        return;
      }
      if (!lines.length) return;
      const box = document.createElement('div');
      box.className = 'registry-extra';
      box.innerHTML = '<strong>Dati proprietario</strong>' + lines.map(([k,v]) => '<div class="extra-line">'+esc(k)+': '+esc(v)+'</div>').join('');
      card.appendChild(box);
    });
  }

  function appendExtrasToDialog(n) {
    const detail = $('#detail');
    if (!detail) return;
    detail.querySelector('.registry-private-extras')?.remove();
    const x = extras.get(Number(n));
    if (!x) return;
    const lines = visibleExtraLines(x);
    const box = document.createElement('section');
    box.className = 'registry-private-extras';
    if (!lines.length && !session) {
      box.innerHTML = '<h3>Dati proprietario verificato</h3><p>Accedi all’area riservata per visualizzare i dati che il proprietario ha scelto di condividere con gli utenti registrati.</p>';
    } else if (lines.length) {
      box.innerHTML = '<h3>Dati proprietario verificato</h3><dl>' + lines.map(([k,v]) => '<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('') + '</dl>';
    } else {
      return;
    }
    detail.appendChild(box);
  }

  if (typeof openCarBase === 'function') {
    window.openCar = function(n) {
      openCarBase(n);
      appendExtrasToDialog(n);
    };
  }

  const grid = $('#grid');
  if (grid) new MutationObserver(() => decorateCards()).observe(grid,{childList:true});

  async function ensureOwnRows() {
    if (!session?.user) return;
    await client.from('profiles').upsert({id:session.user.id},{onConflict:'id',ignoreDuplicates:true});
    await client.from('member_contacts').upsert({user_id:session.user.id},{onConflict:'user_id',ignoreDuplicates:true});
  }

  async function loadProfile() {
    if (!session?.user || !profileForm) return;
    await ensureOwnRows();
    const [{data:p},{data:c}] = await Promise.all([
      client.from('profiles').select('display_name').eq('id',session.user.id).maybeSingle(),
      client.from('member_contacts').select('contact_email,share_email_with_members').eq('user_id',session.user.id).maybeSingle()
    ]);
    profileForm.display_name.value = p?.display_name || '';
    profileForm.contact_email.value = c?.contact_email || '';
    profileForm.share_email.checked = !!c?.share_email_with_members;
  }

  async function loadClaims() {
    if (!session?.user) { claims=[]; renderClaims(); return; }
    const {data,error} = await client.from('owner_vehicle_claims')
      .select('id,launch_number,color,city,latitude,longitude,plate,plate_visibility,estimated_value_eur,value_as_of,value_visibility,contact_address,contact_visibility,evidence_url,status,admin_note,updated_at')
      .eq('owner_id',session.user.id)
      .order('launch_number');
    if (error) throw error;
    claims = data || [];
    renderClaims();
  }

  function renderClaims() {
    if (!claimsList) return;
    if (!claims.length) {
      claimsList.innerHTML = '<p class="muted">Non hai ancora associato una vettura al tuo account.</p>';
      return;
    }
    claimsList.innerHTML = claims.map(c => '<button type="button" class="claim-row" data-claim="'+c.launch_number+'"><span class="claim-num">#'+String(c.launch_number).padStart(3,'0')+'</span><span class="claim-meta">'+esc(c.plate || 'Targa non indicata')+'</span><span class="status-pill '+esc(c.status)+'">'+esc(c.status)+'</span></button>').join('');
    $$('.claim-row', claimsList).forEach(b => b.addEventListener('click', () => {
      claimSelect.value = b.dataset.claim;
      updateNumberAvailability();
      fillClaimForm(Number(b.dataset.claim));
      vehiclePanel?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }

  function fillClaimForm(number) {
    if (!vehicleForm) return;
    const c = claims.find(x => Number(x.launch_number) === Number(number));
    const registered = vehicleOptions.find(v => Number(v.launch_number) === Number(number));
    vehicleForm.color.value = c?.color || registered?.color || '';
    vehicleForm.city.value = c?.city || registered?.city || '';
    vehicleForm.plate.value = c?.plate || '';
    vehicleForm.plate_visibility.value = c?.plate_visibility || 'private';
    vehicleForm.estimated_value_eur.value = c?.estimated_value_eur ?? '';
    vehicleForm.value_as_of.value = c?.value_as_of || '';
    vehicleForm.value_visibility.value = c?.value_visibility || 'public';
    vehicleForm.contact_address.value = c?.contact_address || '';
    vehicleForm.contact_visibility.value = c?.contact_visibility || 'private';
    vehicleForm.evidence_url.value = c?.evidence_url || '';
    const status = $('#claimStatus');
    if (status) status.textContent = c ? 'Stato: '+c.status+(c.admin_note ? ' · '+c.admin_note : '') : 'Nuova richiesta: sarà sottoposta a verifica.';
  }


  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    message('Accesso in corso…');
    const fd = new FormData(loginForm);
    const {error} = await client.auth.signInWithPassword({
      email:String(fd.get('email')||'').trim(),
      password:String(fd.get('password')||'')
    });
    resetCaptcha();
    if (error) message(error.message,'error'); else message('Accesso effettuato.','success');
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(registerForm);
    if (botTrapTriggered(fd)) {
      message('Richiesta bloccata dalla protezione anti-bot. Riprova tra qualche secondo.','error');
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      message('Completa il controllo CAPTCHA.','error');
      return;
    }
    message('Creazione account…');
    const email = String(fd.get('email')||'').trim();
    const password = String(fd.get('password')||'');
    const display_name = String(fd.get('display_name')||'').trim();
    const options = {
      data:{display_name},
      emailRedirectTo:'https://capaccio78.github.io/giulietta-qv-registry/'
    };
    if (captchaToken) options.captchaToken = captchaToken;
    const {data,error} = await client.auth.signUp({email,password,options});
    resetCaptcha();
    if (error) return message(error.message,'error');
    if (data.session) message('Account creato e accesso effettuato.','success');
    else message('Account creato. Controlla l’email per confermare la registrazione, poi torna qui e accedi.','success');
  });

  resetPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(resetPasswordForm);
    if (botTrapTriggered(fd)) {
      message('Richiesta bloccata dalla protezione anti-bot. Riprova tra qualche secondo.','error');
      return;
    }
    const email = String(fd.get('email')||'').trim();
    message('Invio del link di recupero…');
    const {error} = await client.auth.resetPasswordForEmail(email, {
      redirectTo:'https://capaccio78.github.io/giulietta-qv-registry/'
    });
    if (error) message(error.message,'error');
    else message('Se l’indirizzo è registrato, riceverai un link per impostare una nuova password.','success');
  });

  changePasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!session?.user) return;
    const fd = new FormData(changePasswordForm);
    const currentPassword = String(fd.get('current_password')||'');
    const newPassword = String(fd.get('new_password')||'');
    const confirmPassword = String(fd.get('confirm_password')||'');
    if (newPassword !== confirmPassword) {
      if (passwordMessage) {
        passwordMessage.textContent = 'Le due nuove password non coincidono.';
        passwordMessage.className = 'auth-message error';
      }
      return;
    }
    if (!recoveryMode && !currentPassword) {
      if (passwordMessage) {
        passwordMessage.textContent = 'Inserisci la password attuale.';
        passwordMessage.className = 'auth-message error';
      }
      return;
    }
    const payload = recoveryMode ? {password:newPassword} : {password:newPassword,currentPassword};
    const {error} = await client.auth.updateUser(payload);
    if (passwordMessage) {
      passwordMessage.textContent = error ? error.message : 'Password aggiornata.';
      passwordMessage.className = 'auth-message ' + (error ? 'error' : 'success');
    }
    if (!error) {
      sessionStorage.removeItem('qv-password-recovery');
      setRecoveryMode(false);
      changePasswordForm.reset();
    }
  });

  resendSignup?.addEventListener('click', async () => {
    const email = String(loginForm?.email?.value || registerForm?.email?.value || '').trim();
    if (!email) {
      message('Inserisci prima l’email usata per la registrazione.','error');
      return;
    }
    message('Invio di una nuova email di attivazione…');
    const {error} = await client.auth.resend({
      type:'signup',
      email,
      options:{emailRedirectTo:'https://capaccio78.github.io/giulietta-qv-registry/'}
    });
    if (error) message(error.message,'error');
    else message('Nuova email inviata. Usa il link più recente ricevuto.','success');
  });

  logoutBtn?.addEventListener('click', async () => {
    sessionStorage.removeItem('qv-password-recovery');
    setRecoveryMode(false);
    await client.auth.signOut();
    location.hash = 'account';
  });

  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!session?.user) return;
    const fd = new FormData(profileForm);
    const display_name = String(fd.get('display_name')||'').trim() || null;
    const contact_email = String(fd.get('contact_email')||'').trim() || null;
    const share_email_with_members = fd.get('share_email') === 'on';
    const [a,b] = await Promise.all([
      client.from('profiles').upsert({id:session.user.id,display_name},{onConflict:'id'}),
      client.from('member_contacts').upsert({user_id:session.user.id,contact_email,share_email_with_members},{onConflict:'user_id'})
    ]);
    const out = $('#profileMessage');
    if (a.error || b.error) {
      out.textContent = (a.error || b.error).message;
      out.className='auth-message error';
    } else {
      out.textContent='Profilo aggiornato.';
      out.className='auth-message success';
      await loadExtras();
    }
  });

  vehicleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!session?.user) return;
    const fd = new FormData(vehicleForm);
    const launch_number = Number(fd.get('launch_number'));
    const state = numberState(launch_number);
    const out = $('#claimMessage');
    if (!state.valid) {
      out.textContent='Il numero Launch Edition deve essere compreso tra 1 e 999.';
      out.className='auth-message error';
      return;
    }
    if (state.taken && !state.own && !String(fd.get('evidence_url')||'').trim()) {
      out.textContent='Questo numero è già presente nel registro. Per rivendicarlo inserisci una fonte/prova della proprietà.';
      out.className='auth-message error';
      return;
    }
    const registeredVehicle = state.vehicle;
    const color = String(fd.get('color') || registeredVehicle?.color || '').trim();
    const city = String(fd.get('city') || registeredVehicle?.city || '').trim();
    if (!['Rosso Alfa','Rosso Competizione','Grigio Magnesio Opaco'].includes(color) || city.length < 2) {
      out.textContent='Colore ufficiale e città sono obbligatori.';
      out.className='auth-message error';
      return;
    }
    let latitude = Number(registeredVehicle?.latitude), longitude = Number(registeredVehicle?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) try {
      const geo = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=it,fr,nl,ch,hu&q='+encodeURIComponent(city), {headers:{'Accept':'application/json'}});
      if (geo.ok) {
        const hits = await geo.json();
        if (hits?.[0]) {
          latitude = Number(hits[0].lat);
          longitude = Number(hits[0].lon);
        }
      }
    } catch (_) {}
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      out.textContent='Città non trovata sulla mappa. Inserisci città e provincia/Paese, ad esempio “Milano, Italia”.';
      out.className='auth-message error';
      return;
    }
    const existing = claims.find(x => Number(x.launch_number) === launch_number);
    const payload = {
      owner_id: session.user.id,
      launch_number,
      color,
      city,
      latitude,
      longitude,
      plate: String(fd.get('plate')||'').trim().toUpperCase() || null,
      plate_visibility: String(fd.get('plate_visibility')||'private'),
      estimated_value_eur: fd.get('estimated_value_eur') ? Number(fd.get('estimated_value_eur')) : null,
      value_as_of: String(fd.get('value_as_of')||'') || null,
      value_visibility: String(fd.get('value_visibility')||'public'),
      contact_address: String(fd.get('contact_address')||'').trim() || null,
      contact_visibility: String(fd.get('contact_visibility')||'private'),
      evidence_url: String(fd.get('evidence_url')||'').trim() || null
    };
    const res = existing
      ? await client.from('owner_vehicle_claims').update(payload).eq('id',existing.id)
      : await client.from('owner_vehicle_claims').insert(payload);
    if (res.error) {
      out.textContent=res.error.message;
      out.className='auth-message error';
    } else {
      out.textContent = state.taken ? 'Richiesta salvata. Il numero esiste già: la rivendicazione resta in verifica.' : 'Numero salvato e approvato automaticamente.';
      out.className='auth-message success';
      await loadClaims();
      updateNumberAvailability();
      fillClaimForm(launch_number);
    }
  });

  async function onSession(next) {
    session = next;
    setAuthUi();
    await loadExtras();
    if (session?.user) {
      await Promise.all([loadProfile(),loadClaims()]);
    } else {
      claims=[]; renderClaims();
    }
  }

  async function init() {
    if (!window.supabase?.createClient) {
      message('Servizio area riservata non disponibile. Ricarica la pagina.','error');
      return;
    }
    client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    window.giuliettaSupabase = client;
    try {
      await loadVehicleOptions();
      const {data:{session:current}} = await client.auth.getSession();
      if ((openedFromRecoveryLink || sessionStorage.getItem('qv-password-recovery') === '1') && current?.user) {
        setRecoveryMode(true);
      }
      await onSession(current);
      if ((openedFromRecoveryLink || sessionStorage.getItem('qv-password-recovery') === '1') && current?.user) {
        location.hash = 'account';
        setTimeout(() => $('#passwordBox')?.scrollIntoView({behavior:'smooth',block:'center'}),100);
      }
      renderCaptcha();
      client.auth.onAuthStateChange((event,next) => setTimeout(async () => {
        if (event === 'PASSWORD_RECOVERY') {
          sessionStorage.setItem('qv-password-recovery','1');
          setRecoveryMode(true);
          location.hash = 'account';
        }
        await onSession(next);
        if (event === 'PASSWORD_RECOVERY') {
          $('#passwordBox')?.scrollIntoView({behavior:'smooth',block:'center'});
        }
      },0));
    } catch (err) {
      message(err?.message || 'Errore di collegamento all’area riservata.','error');
    }
  }

  setTab('login');
  setAuthUi();
  init();
})();