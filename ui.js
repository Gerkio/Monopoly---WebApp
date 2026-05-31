// UI helpers — toasts, modal scope, keyboard bindings.
// Vanilla, no deps. Exposed on window.UI. Loads after i18n.js, before monopoly.js.
var UI = (function () {

	function ensureOverlay() {
		var el = document.getElementById('ui-overlay');
		if (el) return el;
		el = document.createElement('div');
		el.id = 'ui-overlay';
		document.body.appendChild(el);
		return el;
	}

	// Lightweight transient notification. Auto-removes after duration.
	// kind: 'info' (default) | 'success' | 'warning' | 'danger'
	function toast(messageText, opts) {
		opts = opts || {};
		var overlay = ensureOverlay();
		var node = document.createElement('div');
		node.className = 'toast toast-' + (opts.kind || 'info');
		node.textContent = messageText;
		overlay.appendChild(node);

		var duration = opts.duration || 2400;
		// Remove on the out-animation end; setTimeout only adds the exit class.
		setTimeout(function () { node.classList.add('toast-out'); }, duration);
		node.addEventListener('animationend', function (e) {
			if (e.animationName === 'toast-out') {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		});
	}

	// Single-modal contract. Tracks which modal element is currently open so:
	//  - Esc closes the topmost,
	//  - opening a second modal closes the first,
	//  - the dock primary button is dimmed via body[data-modal-open].
	var activeModalId = null;

	// Focus stack: when openModal()/openPopup() pushes, we capture the
	// element that had focus right before so closeModal()/closePopup() can
	// restore it. Keyboard users keep their place; mouse users see no diff.
	var focusStack = [];
	function pushFocus() {
		var ae = document.activeElement;
		// Skip <body> and null — restoring to them is a no-op that wastes a slot.
		if (ae && ae !== document.body) focusStack.push(ae);
		else focusStack.push(null);
	}
	function popFocus() {
		var prev = focusStack.length ? focusStack.pop() : null;
		if (prev && typeof prev.focus === 'function') {
			try { prev.focus(); } catch (e) { /* element detached */ }
		}
	}

	function openModal(elId) {
		var el = document.getElementById(elId);
		if (!el) return;
		if (activeModalId && activeModalId !== elId) closeModal();
		pushFocus();
		el.classList.add('modal-open');
		activeModalId = elId;
		document.body.setAttribute('data-modal-open', elId);
	}

	function closeModal() {
		if (!activeModalId) return;
		var el = document.getElementById(activeModalId);
		if (el) el.classList.remove('modal-open');
		activeModalId = null;
		document.body.removeAttribute('data-modal-open');
		popFocus();
	}

	function isModalOpen() { return activeModalId !== null; }

	function isVisible(id) {
		var el = document.getElementById(id);
		if (!el) return false;
		var d = el.style.display;
		return d !== 'none' && d !== '';
	}

	// Hide-by-id helper. Uses jQuery if available (matches legacy fadeOut
	// behavior on #popupbackground / #statsbackground); raw .style otherwise.
	function hideById(id, fade) {
		var $ = window.jQuery;
		if ($) {
			if (fade) $('#' + id).fadeOut(200);
			else $('#' + id).hide();
		} else {
			var el = document.getElementById(id);
			if (el) el.style.display = 'none';
		}
	}

	// Close the legacy popup (#popupwrap + #popupbackground).
	// monopoly.js's popup() already restores focus via its own prevFocus
	// closure when a button is clicked, so we do NOT pop the focus stack
	// here (no push happens when popup() opens). This helper only consolidates
	// the show/hide jQuery duplication for the Esc fallback.
	function closePopup() {
		hideById('popupwrap', false);
		hideById('popupbackground', true);
	}
	// Close the stats overlay (#statswrap + #statsbackground). Restores focus
	// since stats are opened via UI.openModal which DID push to the stack.
	function closeStats() {
		hideById('statswrap', false);
		hideById('statsbackground', true);
		popFocus();
	}

	// Screen-reader announcer wrappers. Two live regions live in index.html:
	//   #turn-announcer (assertive) — turn changes, dice rolls, urgent state
	//   #game-announcer (polite)    — rent paid, property bought, etc.
	// We clear → setTimeout → assign so identical consecutive messages still
	// fire (some screen readers de-duplicate identical text).
	function _say(id, text) {
		var el = document.getElementById(id);
		if (!el || !text) return;
		el.textContent = '';
		setTimeout(function () { el.textContent = text; }, 16);
	}
	function announce(text)       { _say('game-announcer', text); }
	function announceUrgent(text) { _say('turn-announcer', text); }

	// Snapshot the currently focused element BEFORE a popup opens, so
	// closePopup() can restore it. monopoly.js's popup() should call this
	// just before showing #popupwrap; closePopup() does the pop.
	function rememberFocus() { pushFocus(); }

	// Single delegated keyboard listener. Activates after window.onload.
	var keysBound = false;
	function bindKeys() {
		if (keysBound) return;
		keysBound = true;
		document.addEventListener('keydown', function (e) {
			// Don't hijack typing in inputs/selects/textareas.
			var t = e.target;
			var tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
			if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

			if (e.key === 'Escape') {
				// Route legacy popup/stats closes through helpers so focus is
				// restored regardless of which path opened the panel.
				if (isVisible('popupwrap')) { closePopup(); return; }
				if (isVisible('statswrap')) { closeStats(); return; }
				closeModal();
				return;
			}

			// Primary action shortcut: Space / Enter triggers the active primary button
			// (Roll Dice / End turn / Start Game) only when no modal is open.
			if ((e.key === ' ' || e.key === 'Enter') && !isModalOpen()) {
				// During setup the primary is the Start Game button; once playing it's #nextbutton.
				var setupVisible = document.getElementById('setup').style.display !== 'none';
				if (setupVisible) {
					var startBtn = document.querySelector('#setup input[type="button"]');
					if (startBtn) { e.preventDefault(); startBtn.click(); }
				} else if (document.getElementById('control').style.display !== 'none') {
					e.preventDefault();
					document.getElementById('nextbutton').click();
				}
				return;
			}

			// Tab shortcuts (only while playing, no modal, no input focused).
			if (isModalOpen()) return;
			if (document.getElementById('control').style.display === 'none') return;

			if (e.key === 'b' || e.key === 'B') {
				document.getElementById('buy-menu-item').click();
			} else if (e.key === 'm' || e.key === 'M') {
				document.getElementById('manage-menu-item').click();
			} else if (e.key === 't' || e.key === 'T') {
				document.getElementById('trade-menu-item').click();
			} else if (e.key === 's' || e.key === 'S') {
				document.getElementById('viewstats').click();
			}
		});
	}

	// Lazy-load the wood-grain body texture (images/maderafondo.png, ~757KB).
	// We intentionally do NOT include the texture in the body's initial
	// background so the first paint isn't blocked on a 757KB PNG decode.
	// Once the game stage is up and interactive, monopoly.js calls this to
	// preload the image off the critical path; on success we flip
	// body.classList.add('wood-loaded') and CSS fades the texture in via
	// body::after (opacity-only, compositor-friendly).
	// Idempotent: safe to call multiple times.
	var woodLoadStarted = false;
	function loadWoodTexture() {
		if (woodLoadStarted) return;
		woodLoadStarted = true;
		var src = 'images/maderafondo.png';
		var img = new Image();
		img.onload = function () {
			// Defer the class flip to the next frame so we don't fight whatever
			// layout/paint the caller just kicked off (e.g. fitStage / setup).
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(function () {
					document.body.classList.add('wood-loaded');
				});
			} else {
				document.body.classList.add('wood-loaded');
			}
		};
		img.onerror = function () {
			// Network/decoding failed — leave the solid surface color in place.
			// Reset the guard so a later caller can retry if it wants.
			woodLoadStarted = false;
		};
		img.src = src;
	}

	return {
		toast: toast,
		openModal: openModal,
		closeModal: closeModal,
		isModalOpen: isModalOpen,
		bindKeys: bindKeys,
		ensureOverlay: ensureOverlay,
		loadWoodTexture: loadWoodTexture,
		// Focus + live-region helpers (Item 1: accessibility hardening).
		closePopup: closePopup,
		closeStats: closeStats,
		rememberFocus: rememberFocus,
		announce: announce,
		announceUrgent: announceUrgent
	};
})();

// =============================================================
// Sound — tiny synthesized SFX via Web Audio. No audio files.
// Browsers require a user gesture before audio can play, so we
// lazily init the AudioContext on the first click.
// =============================================================
var Sound = (function () {
	var ctx = null;
	var enabled = true;     // browser-level (AudioContext available)
	var muted = false;      // user-level (mute button)

	// Restore mute preference from localStorage.
	try {
		var saved = window.localStorage.getItem('monopoly:muted');
		if (saved === '1') muted = true;
	} catch (e) {}

	function setMuted(m) {
		muted = !!m;
		try { window.localStorage.setItem('monopoly:muted', muted ? '1' : '0'); } catch (e) {}
	}
	function isMuted() { return muted; }

	function ensureCtx() {
		if (!ctx) {
			try {
				var AC = window.AudioContext || window.webkitAudioContext;
				if (!AC) { enabled = false; return null; }
				ctx = new AC();
			} catch (e) { enabled = false; return null; }
		}
		// Browsers (Chrome, Safari) start the context in `suspended` and only
		// resume on user-gesture-triggered resume(). Without this, osc.start()
		// is silent on iOS/Safari and Chrome may also silently throw the
		// first sound away.
		if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
			try { ctx.resume(); } catch (e) {}
		}
		return ctx;
	}

	function canPlay() { return enabled && !muted; }

	// One short percussive "tick" — a square wave that decays quickly.
	function tick(freq, duration, volume) {
		var c = ensureCtx();
		if (!c) return;
		var t = c.currentTime;
		var osc = c.createOscillator();
		var gain = c.createGain();
		osc.type = 'square';
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(volume, t);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		osc.connect(gain);
		gain.connect(c.destination);
		osc.start(t);
		osc.stop(t + duration);
	}

	// Dice roll: 5–7 rapid clicks with slight pitch variation,
	// spread across ~500 ms to overlap with the tumble animation.
	function dice() {
		if (!canPlay()) return;
		var c = ensureCtx();
		if (!c) return;
		var ticks = 5 + Math.floor(Math.random() * 3);
		for (var i = 0; i < ticks; i++) {
			(function (idx) {
				var delay = idx * 70 + Math.random() * 40;
				setTimeout(function () {
					tick(180 + Math.random() * 260, 0.055, 0.05);
				}, delay);
			})(i);
		}
	}

	// Token landing on a cell: dry "tock" — wooden piece on cardboard.
	// Built from two layers played simultaneously:
	//   (1) a short filtered noise burst → the click of cardboard contact
	//   (2) a very fast low-sine pulse   → the wood body's brief resonance
	function move() {
		if (!canPlay()) return;
		var c = ensureCtx();
		if (!c) return;
		var t = c.currentTime;

		// (1) Noise burst, ~45 ms, filtered down low so it reads as a thud
		// not a hiss. Fades out fast with a quartic curve.
		var dur = 0.045;
		var bufSize = Math.floor(c.sampleRate * dur);
		var buf = c.createBuffer(1, bufSize, c.sampleRate);
		var data = buf.getChannelData(0);
		for (var i = 0; i < bufSize; i++) {
			var k = 1 - i / bufSize;
			data[i] = (Math.random() * 2 - 1) * k * k * k * k;
		}
		var noise = c.createBufferSource();
		noise.buffer = buf;
		var lp = c.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 700;
		lp.Q.value = 0.8;
		var noiseGain = c.createGain();
		noiseGain.gain.value = 0.18;
		noise.connect(lp).connect(noiseGain).connect(c.destination);
		noise.start(t);

		// (2) Wood-body pulse: sine at ~180 Hz, decays in 60 ms.
		var osc = c.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = 180;
		var oscGain = c.createGain();
		oscGain.gain.setValueAtTime(0.10, t);
		oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
		osc.connect(oscGain).connect(c.destination);
		osc.start(t);
		osc.stop(t + 0.07);
	}

	// Dice landing thump — deeper, more sustained version of move().
	// Used by the throw handler when the dice settle on their final face.
	function diceLand() {
		if (!canPlay()) return;
		var c = ensureCtx();
		if (!c) return;
		var t = c.currentTime;
		// Filtered noise burst — heavier than move()'s tick.
		var dur = 0.09;
		var bufSize = Math.floor(c.sampleRate * dur);
		var buf = c.createBuffer(1, bufSize, c.sampleRate);
		var data = buf.getChannelData(0);
		for (var i = 0; i < bufSize; i++) {
			var k = 1 - i / bufSize;
			data[i] = (Math.random() * 2 - 1) * k * k * k;
		}
		var noise = c.createBufferSource();
		noise.buffer = buf;
		var lp = c.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 520;
		lp.Q.value = 1.0;
		var noiseGain = c.createGain();
		noiseGain.gain.value = 0.22;
		noise.connect(lp).connect(noiseGain).connect(c.destination);
		noise.start(t);
		// Low body resonance — deeper than the standard token tock.
		var osc = c.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = 110;
		var oscGain = c.createGain();
		oscGain.gain.setValueAtTime(0.14, t);
		oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
		osc.connect(oscGain).connect(c.destination);
		osc.start(t);
		osc.stop(t + 0.18);
	}

	// Money pulse: short upward chirp (positive) or downward (negative).
	function money(positive) {
		if (!canPlay()) return;
		var c = ensureCtx();
		if (!c) return;
		var t = c.currentTime;
		var osc = c.createOscillator();
		var gain = c.createGain();
		osc.type = 'triangle';
		if (positive) {
			osc.frequency.setValueAtTime(520, t);
			osc.frequency.exponentialRampToValueAtTime(820, t + 0.12);
		} else {
			osc.frequency.setValueAtTime(420, t);
			osc.frequency.exponentialRampToValueAtTime(240, t + 0.14);
		}
		gain.gain.setValueAtTime(0.05, t);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
		osc.connect(gain);
		gain.connect(c.destination);
		osc.start(t);
		osc.stop(t + 0.16);
	}

	// Chance / Community Chest card popup — pleasant two-tone ding (perfect fifth).
	function ding() {
		if (!canPlay()) return;
		var c = ensureCtx();
		if (!c) return;
		var t = c.currentTime;
		[660, 988].forEach(function (freq, i) {
			var osc = c.createOscillator();
			var gain = c.createGain();
			osc.type = 'sine';
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.045, t + i * 0.04);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.55);
			osc.connect(gain).connect(c.destination);
			osc.start(t + i * 0.04);
			osc.stop(t + i * 0.04 + 0.6);
		});
	}

	// Property purchase — quick two-note rising chime (cha-ching).
	function coin() {
		if (!canPlay()) return;
		var c = ensureCtx();
		if (!c) return;
		var t = c.currentTime;
		[880, 1320].forEach(function (freq, i) {
			var osc = c.createOscillator();
			var gain = c.createGain();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.05, t + i * 0.07);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.22);
			osc.connect(gain).connect(c.destination);
			osc.start(t + i * 0.07);
			osc.stop(t + i * 0.07 + 0.24);
		});
	}

	// =====================================================================
	// Sample-based audio (real files).
	// Lazy-loaded on first use, cached in `samples`. The dice + siren SFX
	// override the synthesized fall-backs above when they're available; if
	// the file 404s or fails to decode, we silently fall back.
	// =====================================================================
	var samples = {};
	function getSample(key, src, opts) {
		opts = opts || {};
		if (samples[key]) return samples[key];
		var a = new Audio();
		a.src = src;
		a.preload = opts.preload || 'auto';
		// Loop only when explicitly asked. Default volume comes from opts.volume.
		if (opts.loop) a.loop = true;
		// Best-effort autoplay-policy compliance: muted track stays muted.
		samples[key] = a;
		return a;
	}
	// Play a one-shot SFX. Re-uses the cached Audio so rapid retriggers are
	// cheap (rewind to 0, then play). Catches the play() promise rejection
	// that Chrome throws when a user gesture hasn't unlocked audio yet.
	function playSample(key, src, vol) {
		if (!canPlay()) return;
		var a = getSample(key, src);
		a.volume = (typeof vol === 'number') ? vol : 1.0;
		try { a.currentTime = 0; } catch (e) {}
		var p = a.play();
		if (p && typeof p.catch === 'function') p.catch(function () {});
	}
	// Replace the synthesized dice/siren with the recorded samples when
	// they're available. Same callable names so monopoly.js doesn't change.
	function diceSample()  { playSample('dice',  'audio/sfx-dice.mp3',  0.65); }
	function sirenSample() { playSample('siren', 'audio/sfx-siren.mp3', 0.50); }

	// =====================================================================
	// Background music — loops with smooth fade in/out. Only one track
	// plays at a time; switching editions cross-fades. Honours the mute
	// preference: muted while paused, resumes from same offset on un-mute.
	// =====================================================================
	var music = null;       // active HTMLAudioElement
	var musicSrc = null;    // currently set src
	var musicTargetVol = 0; // target volume to fade back to when unmuted
	var fadeTimer = null;
	function fadeTo(el, target, ms, done) {
		if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
		var startVol = el.volume;
		var t0 = performance.now();
		fadeTimer = setInterval(function () {
			var k = Math.min(1, (performance.now() - t0) / ms);
			el.volume = Math.max(0, Math.min(1, startVol + (target - startVol) * k));
			if (k >= 1) { clearInterval(fadeTimer); fadeTimer = null; if (done) done(); }
		}, 30);
	}
	function ensureMusic() {
		if (music) return music;
		music = new Audio();
		music.loop = true;
		music.preload = 'metadata';   // don't waterfall the full file on page load
		music.volume = 0;
		return music;
	}
	// Pick a track and start playing it. If the same track is already
	// active, this is a no-op. Volume defaults to a soft background level.
	function playMusic(src, vol) {
		if (typeof vol !== 'number') vol = 0.22;
		musicTargetVol = vol;
		if (!enabled || muted) return;     // browser blocked us OR user muted
		var m = ensureMusic();
		if (musicSrc === src && !m.paused) return;
		musicSrc = src;
		m.src = src;
		m.volume = 0;
		var p = m.play();
		if (p && typeof p.catch === 'function') p.catch(function () {});
		fadeTo(m, musicTargetVol, 800);
	}
	function stopMusic() {
		if (!music) return;
		var m = music;
		fadeTo(m, 0, 400, function () { try { m.pause(); } catch (e) {} });
	}
	// Convenience: pick the right track for the active edition. Falls back
	// to classic when __EDITION isn't set yet.
	function playMusicForEdition(edition, vol) {
		var ed = edition || (typeof window !== 'undefined' && window.__EDITION) || 'classic';
		var src = (ed === 'nyc') ? 'audio/music-nyc.mp3' : 'audio/music-classic.mp3';
		playMusic(src, vol);
	}

	// Hook mute into music: pause/resume rather than just gain-zero so we
	// don't keep decoding audio in the background unnecessarily.
	var _origSetMuted = setMuted;
	setMuted = function (m) {
		_origSetMuted(m);
		if (music) {
			if (m) {
				try { music.pause(); } catch (e) {}
			} else if (musicSrc) {
				// User un-muted — resume the active track from where it was.
				var p = music.play();
				if (p && typeof p.catch === 'function') p.catch(function () {});
				fadeTo(music, musicTargetVol, 400);
			}
		}
	};

	return {
		dice: dice, move: move, money: money, ding: ding, coin: coin,
		diceLand: diceLand,
		// Recorded samples
		diceSample: diceSample, sirenSample: sirenSample,
		// Music
		playMusic: playMusic, stopMusic: stopMusic,
		playMusicForEdition: playMusicForEdition,
		ensureCtx: ensureCtx, setMuted: setMuted, isMuted: isMuted
	};
})();

// Warm up the AudioContext on the very first user interaction so the
// sounds are unlocked by the time anything triggers them.
document.addEventListener('click', function _audioWarm() {
	Sound.ensureCtx();
	document.removeEventListener('click', _audioWarm);
}, true);

