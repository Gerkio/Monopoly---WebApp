// =====================================================================
// render.js — Sprint 5 split-out from monopoly.js.
// UI rendering: rolling number tween, money pulse, net-worth /
// ranking helpers, money bar, dice cube + 3D throw setup, dice
// tumbling, dice readout, owned-property list.
// =====================================================================

function __animateNumberTo(el, fromVal, toVal, durationMs, opts) {
	if (!el) return;
	opts = opts || {};
	if (el.__numAnimId) {
		cancelAnimationFrame(el.__numAnimId);
		el.__numAnimId = 0;
	}
	var from = Number(fromVal) || 0;
	var to   = Number(toVal)   || 0;
	if (from === to) {
		el.innerHTML = '$ ' + to;
		return;
	}
	var dur = durationMs;
	if (typeof dur !== 'number' || dur <= 0) {
		dur = (to >= from) ? 600 : 400;
	}
	var start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
	if (opts.flash) {
		var flashCls = (to >= from) ? 'money-flash-pos' : 'money-flash-neg';
		el.classList.remove('money-flash-pos', 'money-flash-neg');
		// Force reflow so the class actually re-applies.
		void el.offsetWidth;
		el.classList.add(flashCls);
		setTimeout(function () { el.classList.remove(flashCls); }, 500);
	}
	function step(now) {
		var t = (now - start) / dur;
		if (t >= 1) {
			el.innerHTML = '$ ' + to;
			el.__numAnimId = 0;
			return;
		}
		// easeOutCubic
		var eased = 1 - Math.pow(1 - t, 3);
		var v = Math.round(from + (to - from) * eased);
		el.innerHTML = '$ ' + v;
		el.__numAnimId = requestAnimationFrame(step);
	}
	el.__numAnimId = requestAnimationFrame(step);
}

function __pulseMoney(el, delta) {
	if (!el || !delta) return;
	var cls = delta > 0 ? 'money-pulse-up' : 'money-pulse-down';
	el.classList.remove('money-pulse-up', 'money-pulse-down');
	// Force reflow so the animation restarts even on rapid consecutive pulses.
	void el.offsetWidth;
	el.classList.add(cls);
	var handler = function () {
		el.classList.remove(cls);
		el.removeEventListener('animationend', handler);
	};
	el.addEventListener('animationend', handler);
}

// Computes total assets for a player slot: cash + property prices + half mortgage
// values are NOT counted again (mortgaged properties still count at full price as
// an asset because they can be unmortgaged). Buildings count at their build cost.
function __computeNetWorth(slot) {
	var p = player[slot];
	if (!p) return 0;
	var total = p.money;
	for (var i = 0; i < 40; i++) {
		var sq = square[i];
		if (sq.owner !== slot) continue;
		// If mortgaged, the property's resale value is half the price (the
		// unmortgage cost is higher than that, but for net-worth display
		// half-price is a fair estimate of what the player could realize).
		total += sq.mortgage ? Math.round(sq.price * 0.5) : sq.price;
		if (sq.house)  total += sq.house * (sq.houseprice || 0);
		if (sq.hotel)  total += 5 * (sq.houseprice || 0);
	}
	return total;
}

// Computes 1-based rank by net worth (1 = richest). Ties get the same rank.
function __computeRanks() {
	var worths = [];
	for (var i = 1; i <= pcount; i++) worths.push({ slot: i, w: __computeNetWorth(i) });
	worths.sort(function (a, b) { return b.w - a.w; });
	var ranks = {};
	var lastW = null, lastRank = 0;
	for (var k = 0; k < worths.length; k++) {
		if (worths[k].w !== lastW) { lastRank = k + 1; lastW = worths[k].w; }
		ranks[worths[k].slot] = lastRank;
	}
	return ranks;
}

// Lazy-init the rank + net-worth nodes inside a moneybarcell. Returns
// { rankEl, statsEl, barEl } for the row.
function __ensureRowMeta(slot) {
	var cell = document.getElementById('p' + slot + 'moneybar');
	if (!cell) return null;
	var meta = cell.querySelector('.mb-meta');
	if (meta) {
		return {
			rankEl:  meta.querySelector('.mb-rank'),
			statsEl: meta.querySelector('.mb-stats'),
			barEl:   cell.querySelector('.mb-nw-bar-fill')
		};
	}
	meta = document.createElement('div');
	meta.className = 'mb-meta';
	var rank = document.createElement('span');
	rank.className = 'mb-rank';
	var stats = document.createElement('span');
	stats.className = 'mb-stats';
	meta.appendChild(rank);
	meta.appendChild(stats);
	cell.appendChild(meta);

	// Net-worth comparison bar — fills relative to the leader.
	var bar = document.createElement('div');
	bar.className = 'mb-nw-bar';
	var fill = document.createElement('div');
	fill.className = 'mb-nw-bar-fill';
	bar.appendChild(fill);
	cell.appendChild(bar);

	return { rankEl: rank, statsEl: stats, barEl: fill };
}

function updateMoney() {
	var p = player[turn];
	var pmoneyEl = document.getElementById("pmoney");
	var pmoneyPrev = __prevMoney['turn'];

	// Sprint 1 (S1.1) — read the value currently rendered in the DOM so we
	// can tween it to the new player.money. Strips any "$"/space prefix and
	// commas, falls back to __prevMoney bookkeeping if the DOM is empty
	// (first render of the turn).
	var domTxt = (pmoneyEl.textContent || '').replace(/[^0-9-]/g, '');
	var domVal = domTxt === '' ? null : parseInt(domTxt, 10);
	var fromForAnim = (domVal !== null && !isNaN(domVal))
		? domVal
		: (pmoneyPrev !== undefined ? pmoneyPrev : p.money);

	if (fromForAnim !== p.money) {
		__animateNumberTo(pmoneyEl, fromForAnim, p.money, undefined, { flash: true });
	} else {
		pmoneyEl.innerHTML = "$ " + p.money;
	}

	if (pmoneyPrev !== undefined && pmoneyPrev !== p.money) {
		var pdelta = p.money - pmoneyPrev;
		__pulseMoney(pmoneyEl, pdelta);
		if (typeof __floatMoneyDelta === 'function') __floatMoneyDelta(pmoneyEl, pdelta);
	}
	__prevMoney['turn'] = p.money;

	// Batch-hide all money-bar rows via direct DOM (avoids jQuery .hide() overhead).
	var __allMoneyRows = document.querySelectorAll(".money-bar-row");
	for (var __mr = 0; __mr < __allMoneyRows.length; __mr++) {
		__allMoneyRows[__mr].style.display = "none";
	}

	// Rank players by net worth so each row can show its position (1°/2°/...).
	var ranks = __computeRanks();
	var rankSuffix = ['', 'st', 'nd', 'rd']; // EN; ES uses degree symbol
	var lang = (typeof I18N !== 'undefined' && I18N.get) ? I18N.get() : 'en';

	// Compute max net worth so each row's bar fills relative to the leader.
	var maxNw = 0;
	for (var nwi = 1; nwi <= pcount; nwi++) {
		var nwVal = __computeNetWorth(nwi);
		if (nwVal > maxNw) maxNw = nwVal;
	}
	if (maxNw <= 0) maxNw = 1; // avoid div-by-zero

	for (var i = 1; i <= pcount; i++) {
		p_i = player[i];
		var moneyEl = document.getElementById("p" + i + "money");
		var prev = __prevMoney[i];
		var rowCell = document.getElementById("p" + i + "moneybar");

		// Restore default display (table-row) by clearing inline style.
		document.getElementById("moneybarrow" + i).style.display = "";
		rowCell.style.border = "2px solid " + p_i.color;
		moneyEl.innerHTML = p_i.money;
		document.getElementById("p" + i + "moneyname").textContent = p_i.name;

		// Mark the active player's row with a subtle highlight + expose color
		// for the active arrow + the net-worth bar gradient.
		rowCell.style.setProperty('--row-color', p_i.color);
		if (i === turn) {
			rowCell.classList.add('moneybar-active');
		} else {
			rowCell.classList.remove('moneybar-active');
		}

		if (prev !== undefined && prev !== p_i.money) {
			var delta = p_i.money - prev;
			__pulseMoney(moneyEl, delta);
			if (typeof __floatMoneyDelta === 'function') __floatMoneyDelta(moneyEl, delta);
		}
		__prevMoney[i] = p_i.money;

		// Inject rank badge + net worth / property count.
		var meta = __ensureRowMeta(i);
		if (meta) {
			var r = ranks[i] || pcount;
			var rankTxt = (lang === 'es')
				? r + '°'
				: r + (rankSuffix[r] || 'th');
			meta.rankEl.textContent = rankTxt;
			meta.rankEl.className = 'mb-rank mb-rank-' + r;

			var nw = __computeNetWorth(i);
			var owned = 0;
			for (var pi = 0; pi < 40; pi++) {
				if (square[pi].owner === i) owned++;
			}
			meta.statsEl.innerHTML =
				'<span class="mb-prop" title="' + (typeof t === 'function' ? t('mb.propsTitle') : 'Properties owned') + '">' +
					'<span class="mb-prop-icon">▢</span>' + owned +
				'</span>' +
				'<span class="mb-nw" title="' + (typeof t === 'function' ? t('mb.netWorthTitle') : 'Net worth (cash + assets)') + '">$' + nw + '</span>';

			// Net-worth bar — width as % of the leader's worth.
			if (meta.barEl) {
				var pct = Math.max(2, Math.round((nw / maxNw) * 100));
				meta.barEl.style.width = pct + '%';
			}
		}
	}

	if (document.getElementById("landed").innerHTML === "") {
		UI.$hide("landed");
	}

	document.getElementById("quickstats").style.borderColor = p.color;
	// Enriched quickstats: avatar + name + cash + current cell + turn-order
	// preview. Builds DOM only once and keeps the original #pname / #pmoney
	// spans (other code mutates them).
	__renderQuickStats(p);

	if (p.money < 0) {
		// document.getElementById("nextbutton").disabled = true;
		UI.$show("resignbutton");
		UI.$hide("nextbutton");
	} else {
		// document.getElementById("nextbutton").disabled = false;
		UI.$hide("resignbutton");
		UI.$show("nextbutton");
	}
}

// Per-die accumulated rotation (so each tumble continues from where it ended,
// instead of resetting to identity and losing the spin feel).
var __dieRot = {};

function __ensureDieCube(el) {
	if (el.querySelector('.die-cube')) return;
	// Remove the text-fallback class so the CSS sizing/perspective rules
	// for .die actually apply (die-no-img reverts width/height to auto).
	el.classList.remove('die-no-img');
	// Clear any text content from the fallback render.
	el.innerHTML = '';
	// Clear any inline width/height/padding that may have been applied while
	// die-no-img was active, so the .die rule's 56×56 + perspective take effect.
	el.style.width = '';
	el.style.height = '';
	el.style.padding = '';
	el.style.border = '';
	el.style.background = '';
	el.style.color = '';
	el.style.boxShadow = '';

	var cube = document.createElement('div');
	cube.className = 'die-cube';
	for (var i = 1; i <= 6; i++) {
		var face = document.createElement('div');
		face.className = 'die-face die-face-' + i;
		cube.appendChild(face);
	}
	el.appendChild(cube);
	// Force a layout/style recompute so the cube's CSS-default transform is
	// committed before __tumbleDie sets the inline one. Without this the
	// browser may collapse both into a single computed style and skip the
	// transition on the very first roll.
	void cube.offsetHeight;
	// Drag-spin is handled by __setupDiceThrow() which attaches both dice
	// as one coordinated grab-and-throw system (called from window.onload).
}

// =============================================================
// Physical dice throw — grab EITHER die and BOTH lift off together
// in a single physics-flavored animation:
//
//   1. mousedown → record initial pose, lift both dice off the tray
//      with a tiny "pickup" pop
//   2. drag → cube tumbles 1:1 with mouse movement (no transition),
//      plus a continuous low-level spin so the dice feel alive
//   3. release → capture velocity, fling both dice with momentum
//      and gravity for ~600ms; AT the start of the fling we already
//      compute the rolled values and start tumbling cubes toward
//      those faces — so by the time the dice settle they show the
//      rolled face naturally (no awkward double-tumble)
//   4. dice return to tray with FLIP springback showing the rolled
//      faces, then the game's roll logic continues (move player etc.)
//
// A short click (no drag) triggers a normal roll via the next button.
// =============================================================
var __diceThrowing = false; // global lock during throw
var __diceState = null;     // shared state for the pair while grabbed

// Given the cube's current rotation and a target {x,y} for the desired face,
// returns the SHORTEST rotation that ends up on the target face — anchored
// to the nearest full revolution so settles look natural (no 359° backspins).
function __finalRotationFor(curX, curY, target) {
	var roundedX = Math.round((curX - target.x) / 360) * 360 + target.x;
	var roundedY = Math.round((curY - target.y) / 360) * 360 + target.y;
	return { x: roundedX, y: roundedY };
}

function __setupDiceThrow() {
	var d0 = document.getElementById('die0');
	var d1 = document.getElementById('die1');
	if (!d0 || !d1) return;
	__attachThrow(d0, d1);
	__attachThrow(d1, d0);
}

// `primary` is the die the user clicked on; `partner` is the other die
// that gets lifted along with it.
function __attachThrow(primary, partner) {
	var cubeP = primary.querySelector('.die-cube');
	if (!cubeP) return;

	// Per-grab session state — reset on every mousedown.
	var dragging = false;
	var grabbed = false;
	var startMouseX = 0, startMouseY = 0;
	var lastX = 0, lastY = 0, lastT = 0;
	var velX = 0, velY = 0;
	var totalDist = 0;
	var rotPX = 0, rotPY = 0;   // primary rotation
	var rotSX = 0, rotSY = 0;   // partner rotation
	var GRAB_THRESHOLD = 4;     // px to consider it a drag vs click

	function onDown(e) {
		if (__diceThrowing) return;
		// Block grab during AI turns — the player shouldn't be able to roll
		// while the AI is processing its move.
		if (document.body.getAttribute('data-await') === 'ai') return;
		// Also refuse during an active walk — see flingPair() for the
		// rationale (prevents mid-walk rerolls that desynchronise the dice
		// from the move that's currently playing).
		if (window.GameState.walking) return;
		if (e.type === 'mousedown' && e.button !== 0) return;
		var pt = (e.touches && e.touches[0]) || e;
		startMouseX = pt.clientX;
		startMouseY = pt.clientY;
		lastX = pt.clientX;
		lastY = pt.clientY;
		lastT = performance.now();
		totalDist = 0;
		velX = 0; velY = 0;
		dragging = true;
		grabbed = false;
		var rp = __dieRot[primary.id] || { x: 0, y: 0 };
		var rs = __dieRot[partner.id] || { x: 0, y: 0 };
		rotPX = rp.x; rotPY = rp.y;
		rotSX = rs.x; rotSY = rs.y;
		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
		document.addEventListener('touchmove', onMove, { passive: false });
		document.addEventListener('touchend', onUp);
		if (e.cancelable) e.preventDefault();
	}

	// Gentle ambient spin while held — keeps the dice feeling alive even
	// when the mouse is stationary, but slow enough not to be distracting.
	// Cancelled on release.
	var spinRAF = null;
	function startIdleSpin() {
		var lastTs = performance.now();
		function tick(now) {
			if (!grabbed) { spinRAF = null; return; }
			var dt = (now - lastTs) / 16;
			lastTs = now;
			// Very slow ambient rotation: ~0.25°/frame, scaled by dt.
			rotPX += 0.25 * dt;
			rotPY += 0.18 * dt;
			rotSX += 0.20 * dt;
			rotSY += 0.22 * dt;
			cubeP.style.transform = 'rotateX(' + rotPX + 'deg) rotateY(' + rotPY + 'deg)';
			if (__diceState && __diceState.cubeS) {
				__diceState.cubeS.style.transform = 'rotateX(' + rotSX + 'deg) rotateY(' + rotSY + 'deg)';
			}
			__dieRot[primary.id] = { x: rotPX, y: rotPY };
			__dieRot[partner.id] = { x: rotSX, y: rotSY };
			spinRAF = requestAnimationFrame(tick);
		}
		spinRAF = requestAnimationFrame(tick);
	}

	// Lift BOTH dice "off" the tray — but keep them in their original DOM
	// parent. We only apply transform + high z-index so the dice can fly
	// across the screen without their tray slot collapsing.
	//
	// Key insight: transform doesn't change layout. The dice-tray keeps
	// its dimensions, the sidepanel doesn't reflow, the rest of the UI
	// stays still. Way more robust than re-parenting to <body>.
	function liftOff() {
		__diceState = {
			primary: primary,
			partner: partner,
			cubeP: cubeP,
			cubeS: partner.querySelector('.die-cube')
		};
		var s = __diceState;

		// Mark the tray + dice so CSS can give them high z-index and
		// disable hover/breathing animations during the throw.
		var tray = primary.parentNode;
		if (tray && tray.classList.contains('dice-tray')) {
			tray.classList.add('dice-tray-throwing');
			s.tray = tray;
		}
		[primary, partner].forEach(function (d) {
			d.classList.add('die-airborne');
			d.style.zIndex = '9999';
			d.style.position = 'relative';
			// Tiny pickup pop: scales 1.0 → 1.5 → 1.4 in 180ms.
			d.style.transition = 'transform 180ms cubic-bezier(.34, 1.56, .64, 1)';
			d.style.transform = 'translate(0, 0) scale(1.5)';
		});
		// After the pickup pop, settle to carry scale 1.4 AND set the wrapper
		// transition to 'none' so onMove / fling get perfectly 1:1 cursor
		// response (otherwise the CSS default 200ms ease-out keeps lingering
		// and dice lag visibly behind the mouse).
		setTimeout(function () {
			[primary, partner].forEach(function (d) {
				d.style.transition = 'transform 120ms var(--ease-out)';
				d.style.transform = 'translate(0, 0) scale(1.4)';
			});
			setTimeout(function () {
				primary.style.transition = 'none';
				partner.style.transition = 'none';
			}, 130);
		}, 180);
		cubeP.style.transition = 'none';
		if (s.cubeS) s.cubeS.style.transition = 'none';
		grabbed = true;
		// Warm up audio so the throw sound has no first-tap latency.
		if (typeof Sound !== 'undefined') {
			try { Sound.ensureCtx && Sound.ensureCtx(); } catch (e) {}
		}
		// Start the ambient idle spin so the dice always look "alive" while held.
		startIdleSpin();
	}

	function onMove(e) {
		if (!dragging) return;
		var pt = (e.touches && e.touches[0]) || e;
		var nowT = performance.now();
		var ddx = pt.clientX - lastX;
		var ddy = pt.clientY - lastY;
		var dt = Math.max(1, nowT - lastT);
		var instVx = (ddx / dt) * 16;
		var instVy = (ddy / dt) * 16;
		velX = velX * 0.6 + instVx * 0.4;
		velY = velY * 0.6 + instVy * 0.4;
		lastX = pt.clientX;
		lastY = pt.clientY;
		lastT = nowT;
		totalDist += Math.hypot(ddx, ddy);

		if (!grabbed && totalDist > GRAB_THRESHOLD) liftOff();

		if (grabbed) {
			// Dice live inside the transformed stage, so divide screen-pixel
			// delta by the stage scale to translate them by the same VISUAL
			// distance the mouse traveled.
			var sc = (window.__STAGE_TX && window.__STAGE_TX.scale) || 1;
			var dx = (pt.clientX - startMouseX) / sc;
			var dy = (pt.clientY - startMouseY) / sc;
			// Defensive: force no transition during drag so wrapper transforms
			// apply instantly (the post-pickup setTimeout has already done
			// this, but on slow devices the timeouts may overlap with onMove).
			if (primary.style.transition !== 'none') primary.style.transition = 'none';
			if (partner.style.transition !== 'none') partner.style.transition = 'none';
			primary.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(1.4)';
			partner.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(1.4)';
			// Tumble: same direction but slightly different phases.
			rotPX -= ddy * 2;
			rotPY += ddx * 2;
			rotSX -= ddy * 1.7;
			rotSY += ddx * 1.7;
			cubeP.style.transform = 'rotateX(' + rotPX + 'deg) rotateY(' + rotPY + 'deg)';
			if (__diceState && __diceState.cubeS) {
				__diceState.cubeS.style.transform = 'rotateX(' + rotSX + 'deg) rotateY(' + rotSY + 'deg)';
			}
			__dieRot[primary.id] = { x: rotPX, y: rotPY };
			__dieRot[partner.id] = { x: rotSX, y: rotSY };
		}
		if (e.cancelable) e.preventDefault();
	}

	function onUp() {
		if (!dragging) return;
		dragging = false;
		document.removeEventListener('mousemove', onMove);
		document.removeEventListener('mouseup', onUp);
		document.removeEventListener('touchmove', onMove);
		document.removeEventListener('touchend', onUp);

		if (!grabbed) {
			rollViaButton();
			return;
		}
		__diceThrowing = true;
		flingPair();
	}

	// Single integrated throw animation:
	//   • computes the rolled values up front so the visible result
	//     matches a real die settling
	//   • runs ~700ms of flying-with-gravity + tumbling
	//   • final 250ms eases the cube rotation toward the actual face
	//     so the dice land naturally on their rolled values
	//   • then returns to tray and triggers the game's roll handler
	//     (which is told to skip its own tumble — we already did it)
	function flingPair() {
		// Refuse to roll while a previous walk is still animating. Otherwise
		// flingPair() would clobber the active die1/die2 mid-walk, leaving
		// the next roll with stale dice values and the token moving the
		// wrong number of cells.
		if (window.GameState.walking) { __diceThrowing = false; return; }
		// Stop the idle spin — flingPair takes over rotation control.
		if (spinRAF) { cancelAnimationFrame(spinRAF); spinRAF = null; }
		// 1) Roll the dice now. Values are needed up-front so the cubes
		//    can settle on the correct face by the end of the fling.
		var rolledFace1 = 1, rolledFace2 = 1;
		if (typeof game !== 'undefined' && game.rollDice) {
			try {
				game.rollDice();
				rolledFace1 = game.getDie(1);
				rolledFace2 = game.getDie(2);
			} catch (e) { /* dice override: keep fallback faces */ }
		}

		// 2) Final cube rotation that lands on each rolled face, chosen as
		//    the closest revolution to current rotation (no needless backspins).
		var FACE = __dieFaceRot;
		var endRotP = __finalRotationFor(rotPX, rotPY, FACE[rolledFace1]);
		var endRotS = __finalRotationFor(rotSX, rotSY, FACE[rolledFace2]);

		// 3) Capture current wrapper translation so the fling continues from
		//    wherever the user released, not from origin.
		var m = (primary.style.transform || '').match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
		var startTx = m ? parseFloat(m[1]) : 0;
		var startTy = m ? parseFloat(m[2]) : 0;

		// 4) Cap + scale-compensate the released velocity.
		var sc = (window.__STAGE_TX && window.__STAGE_TX.scale) || 1;
		var vx = Math.max(-140, Math.min(140, velX / sc));
		var vy = Math.max(-140, Math.min(140, velY / sc));

		// Per-die jitter so they separate naturally during flight.
		var jitterPX = (Math.random() - 0.5) * 48;
		var jitterPY = (Math.random() - 0.5) * 48;
		var jitterSX = (Math.random() - 0.5) * 48;
		var jitterSY = (Math.random() - 0.5) * 48;

		// Throw audio cue — recorded dice sample (rolling clatter); falls
		// back to synthesized ticks if the file is unavailable or muted.
		if (typeof Sound !== 'undefined') {
			if (Sound.diceSample) Sound.diceSample();
			else if (Sound.dice) Sound.dice();
		}

		// ── WINDUP (80ms): pull the dice back ~10px opposite to the throw
		//    direction. Mimics a person cocking their wrist before flicking.
		var WIND_MS = 80;
		var windDx = -(vx * 0.20);
		var windDy = -(vy * 0.20);
		[primary, partner].forEach(function (d) {
			d.style.transition = 'transform 80ms cubic-bezier(.4, 0, .6, 1)';
			d.style.transform = 'translate(' + (startTx + windDx) + 'px, ' + (startTy + windDy) + 'px) scale(1.32)';
		});

		setTimeout(function () { runFling(); }, WIND_MS);

		// ── MAIN FLING (~720ms): momentum + gravity + tumble; last 30%
		//    interpolates to the final face. End with a tiny "impact" squash.
		function runFling() {
			// Reset wrapper transitions for free rAF control.
			primary.style.transition = 'none';
			partner.style.transition = 'none';

			var startTs = performance.now();
			var duration = 720;
			// Phase split: 0-0.65 wild tumble + flight, 0.65-1.0 settle to face.
			var SETTLE_FROM = 0.65;
			var rotPX_start = rotPX, rotPY_start = rotPY;
			var rotSX_start = rotSX, rotSY_start = rotSY;
			// Captured during settle so the final position is stable for return.
			var settlePosX = 0, settlePosY = 0;

			function step(now) {
				var t = Math.min(1, (now - startTs) / duration);
				var easeOut = 1 - Math.pow(1 - t, 3);

				// Position: ease out from windup position, with gravity arc.
				var tx = startTx + vx * t * 30 * (1 - easeOut * 0.65);
				var ty = startTy + vy * t * 30 * (1 - easeOut * 0.65) + easeOut * easeOut * 150;

				// Tiny impact squash at the very end — die "lands" with scale
				// dip from 1.4 → 1.28 → 1.4 in the last 12% of the fling.
				var scaleNow = 1.4;
				if (t > 0.88) {
					var impact = (t - 0.88) / 0.12;            // 0..1
					var dip = Math.sin(impact * Math.PI);        // peak at 0.5
					scaleNow = 1.4 - dip * 0.12;                 // dips to 1.28
				}
				primary.style.transform = 'translate(' + (tx + jitterPX * easeOut) + 'px, ' + (ty + jitterPY * easeOut) + 'px) scale(' + scaleNow + ')';
				partner.style.transform = 'translate(' + (tx + jitterSX * easeOut) + 'px, ' + (ty + jitterSY * easeOut) + 'px) scale(' + scaleNow + ')';

				if (t < SETTLE_FROM) {
					// Tumble at decaying intensity.
					rotPX += (vy * 4) * (1 - easeOut) + 6;
					rotPY += (vx * 4) * (1 - easeOut) + 4;
					rotSX += (vy * 3.4) * (1 - easeOut) - 5;
					rotSY += (vx * 3.4) * (1 - easeOut) + 3;
					rotPX_start = rotPX; rotPY_start = rotPY;
					rotSX_start = rotSX; rotSY_start = rotSY;
				} else {
					// Smoothly interpolate to the rolled face.
					var settleT = (t - SETTLE_FROM) / (1 - SETTLE_FROM);
					var settleE = 1 - Math.pow(1 - settleT, 2);
					rotPX = rotPX_start + (endRotP.x - rotPX_start) * settleE;
					rotPY = rotPY_start + (endRotP.y - rotPY_start) * settleE;
					rotSX = rotSX_start + (endRotS.x - rotSX_start) * settleE;
					rotSY = rotSY_start + (endRotS.y - rotSY_start) * settleE;
				}
				cubeP.style.transform = 'rotateX(' + rotPX + 'deg) rotateY(' + rotPY + 'deg)';
				if (__diceState && __diceState.cubeS) {
					__diceState.cubeS.style.transform = 'rotateX(' + rotSX + 'deg) rotateY(' + rotSY + 'deg)';
				}

				// Capture the final position for the return-to-tray FLIP.
				settlePosX = tx + jitterPX * easeOut;
				settlePosY = ty + jitterPY * easeOut;

				if (t < 1) {
					requestAnimationFrame(step);
				} else {
					__dieRot[primary.id] = { x: endRotP.x, y: endRotP.y };
					__dieRot[partner.id] = { x: endRotS.x, y: endRotS.y };
					// Guard: state could have been wiped by an external event
					// (new game / hard reload during throw). Skip the bookkeeping
					// in that case and just continue.
					if (__diceState) {
						__diceState.endTx = settlePosX;
						__diceState.endTy = settlePosY;
					}
					// Heavy "thump" when the dice land on their faces.
					if (typeof Sound !== 'undefined' && Sound.diceLand) Sound.diceLand();
					// Sprint 1 (S1.4a) — short haptic tap on mobile to match the thump.
					if (typeof __haptic === 'function') __haptic([50]);
					returnPairAndContinueRoll();
				}
			}
			requestAnimationFrame(step);
		}
	}

	function returnPairAndContinueRoll() {
		var s = __diceState;
		// Defensive: if state was somehow wiped, bail with clean flags so
		// future throws aren't blocked forever.
		if (!s) {
			__diceThrowing = false;
			return;
		}
		// 1) Quick fly-back from settle position to tray (200ms).
		[primary, partner].forEach(function (d) {
			d.style.transition = 'transform 200ms cubic-bezier(.25, .8, .25, 1)';
			d.style.transform = 'translate(0, 0) scale(1.08)';   // overshoot scale
		});
		// 2) Tiny settle bounce: scale dips to 0.94 then springs to 1.
		setTimeout(function () {
			[primary, partner].forEach(function (d) {
				d.style.transition = 'transform 140ms cubic-bezier(.18, .9, .25, 1.4)';
				d.style.transform = 'translate(0, 0) scale(0.94)';
			});
		}, 200);
		setTimeout(function () {
			[primary, partner].forEach(function (d) {
				d.style.transition = 'transform 180ms cubic-bezier(.34, 1.56, .64, 1)';
				d.style.transform = 'translate(0, 0) scale(1)';
			});
		}, 340);
		// 3) Final cleanup after the whole settle sequence completes.
		setTimeout(function () {
			[primary, partner].forEach(function (d) {
				d.style.transition = '';
				d.style.transform = '';
				d.style.zIndex = '';
				d.style.position = '';
				d.classList.remove('die-airborne');
			});
			if (s.tray) s.tray.classList.remove('dice-tray-throwing');
			cubeP.style.transition = '';
			if (s.cubeS) s.cubeS.style.transition = '';
			__diceState = null;
			__diceThrowing = false;
			// Continue the game's normal post-roll flow. Values were rolled
			// in flingPair() and cubes show the final faces.
			continueGameRoll();
		}, 540);
	}

	// Bridge to the game's roll-button flow. If a throw is in progress, the
	// regular roll() flow runs but updateDice is suppressed via a flag so we
	// don't get a second tumble. roll() is synchronous, so the flag is
	// cleared right after btn.click() returns — wrapped in try/finally so
	// an exception inside roll() doesn't leave the flag stuck for future rolls.
	function continueGameRoll() {
		window.GameState.skipNextUpdateDice = true;
		try {
			var btn = document.getElementById('nextbutton');
			if (btn && document.getElementById('control').style.display !== 'none') {
				btn.click();
			}
		} finally {
			window.GameState.skipNextUpdateDice = false;
		}
	}

	function rollViaButton() {
		var btn = document.getElementById('nextbutton');
		if (btn && document.getElementById('control').style.display !== 'none') {
			btn.click();
		}
	}

	primary.addEventListener('mousedown', onDown);
	primary.addEventListener('touchstart', onDown, { passive: false });
}

// Rotation that places the requested face toward the camera.
// 1=front, 2=top, 3=right, 4=left, 5=bottom, 6=back (sum of opposites = 7).
var __dieFaceRot = {
	1: { x:   0, y:    0 },
	2: { x: -90, y:    0 },
	3: { x:   0, y:  -90 },
	4: { x:   0, y:   90 },
	5: { x:  90, y:    0 },
	6: { x:   0, y:  180 }
};

function __tumbleDie(el, face) {
	__ensureDieCube(el);
	var cube = el.querySelector('.die-cube');
	if (!cube) return;
	var base = __dieFaceRot[face];
	var prev = __dieRot[el.id] || { x: 0, y: 0 };
	// Anchor to nearest full revolution so the rotation diff is predictable,
	// then add 3-5 spins per axis (random direction) for a dramatic tumble,
	// finishing on `base`.
	var roundedX = Math.round(prev.x / 360) * 360;
	var roundedY = Math.round(prev.y / 360) * 360;
	var spinsX = (Math.floor(Math.random() * 3) + 3) * 360 * (Math.random() > 0.5 ? 1 : -1);
	var spinsY = (Math.floor(Math.random() * 3) + 3) * 360 * (Math.random() > 0.5 ? 1 : -1);
	var nextX = roundedX + spinsX + base.x;
	var nextY = roundedY + spinsY + base.y;
	cube.style.transform = 'rotateX(' + nextX + 'deg) rotateY(' + nextY + 'deg)';
	__dieRot[el.id] = { x: nextX, y: nextY };
	el.title = "Die (" + face + " spots)";

	// "Toss" pop — small upward bounce so the dice feel physically thrown.
	// Re-trigger by removing the class, forcing a reflow, then re-adding.
	el.classList.remove('die-toss');
	void el.offsetWidth;
	el.classList.add('die-toss');
	setTimeout(function () { el.classList.remove('die-toss'); }, 820);
}

function updateDice() {
	var die0 = game.getDie(1);
	var die1 = game.getDie(2);

	UI.$show("die0");
	UI.$show("die1");

	// If the throw handler already landed the cubes on the rolled faces,
	// skip the tumble AND the dice-tick sound — flingPair() already played
	// Sound.dice() at throw-start and Sound.diceLand() at touchdown, so
	// another tick here would be a third audible event.
	// Flag is NOT cleared here because roll() can call updateDice twice
	// in the doubles path. continueGameRoll clears it after btn.click()
	// returns (i.e. after the entire synchronous roll completes).
	if (window.GameState.skipNextUpdateDice) {
		return;
	}

	__tumbleDie(document.getElementById("die0"), die0);
	__tumbleDie(document.getElementById("die1"), die1);

	// Recorded dice sample first (cinematic), synth tick as fallback layer.
	if (typeof Sound !== 'undefined') {
		if (Sound.diceSample) Sound.diceSample();
		else if (Sound.dice) Sound.dice();
	}
}

function updateOwned() {
	var p = player[turn];
	var checkedproperty = getCheckedProperty();
	UI.$show("option");
	UI.$show("owned");

	var firstproperty = -1;

	// Collect HTML fragments in an array (Array.join is O(n) vs O(n^2) string concat).
	var htmlParts = [];
	var mortgagetext = "";
	var houseParts = [];
	var sq;

	// Single pass over all 40 squares:
	//  1) update cell-owner indicator display via pure DOM (CSS default = display:none),
	//  2) build owned-property table rows for the active turn.
	for (var i = 0; i < 40; i++) {
		sq = square[i];

		if (sq.groupNumber) {
			var currentCellOwner = document.getElementById("cell" + i + "owner");
			if (sq.owner > 0) {
				currentCellOwner.style.display = "block";
				currentCellOwner.style.backgroundColor = player[sq.owner].color;
				currentCellOwner.title = player[sq.owner].name;
			} else {
				// Clear inline display so CSS default (.cell-owner { display: none }) applies.
				currentCellOwner.style.display = "";
			}
		}

		if (sq.owner == turn) {

			mortgagetext = "";
			if (sq.mortgage) {
				mortgagetext = "title='" + I18N.escape(t('stats.mortgagedTooltip')) + "' style='color: grey;'";
			}

			houseParts.length = 0;
			if (sq.house >= 1 && sq.house <= 4) {
				for (var x = 1; x <= sq.house; x++) {
					houseParts.push("<img src='images/house.png' alt='' title='House' class='house' width='26' height='20' />");
				}
			} else if (sq.hotel) {
				houseParts.push("<img src='images/hotel.png' alt='' title='Hotel' class='hotel' width='28' height='20' />");
			}
			var housetext = houseParts.join("");

			if (htmlParts.length === 0) {
				htmlParts.push("<table>");
				firstproperty = i;
			}

			htmlParts.push("<tr class='property-cell-row' data-property-index='" + i + "'><td class='propertycellcheckbox'><input type='checkbox' id='propertycheckbox" + i + "' /></td><td class='propertycellcolor' style='background: " + sq.color + ";");

			if (sq.groupNumber == 1 || sq.groupNumber == 2) {
				htmlParts.push(" border: 1px solid grey; width: 18px;");
			}

			htmlParts.push("' onmouseover='showdeed(" + i + ");' onmouseout='hidedeed();'></td><td class='propertycellname' " + mortgagetext + ">" + sq.name + housetext + "</td></tr>");
		}
	}

	var HTML = htmlParts.join("");

	if (p.communityChestJailCard) {
		if (HTML === "") {
			firstproperty = 40;
			HTML += "<table>";
		}
		HTML += "<tr class='property-cell-row'><td class='propertycellcheckbox'><input type='checkbox' id='propertycheckbox40' /></td><td class='propertycellcolor' style='background: white;'></td><td class='propertycellname'>Get Out of Jail Free Card</td></tr>";

	}
	if (p.chanceJailCard) {
		if (HTML === "") {
			firstproperty = 41;
			HTML += "<table>";
		}
		HTML += "<tr class='property-cell-row'><td class='propertycellcheckbox'><input type='checkbox' id='propertycheckbox41' /></td><td class='propertycellcolor' style='background: white;'></td><td class='propertycellname'>Get Out of Jail Free Card</td></tr>";
	}

	if (HTML === "") {
		HTML = p.name + ", you don't have any properties.";
		UI.$hide("option");
	} else {
		HTML += "</table>";
	}

	document.getElementById("owned").innerHTML = HTML;

	// Select previously selected property.
	if (checkedproperty > -1 && document.getElementById("propertycheckbox" + checkedproperty)) {
		document.getElementById("propertycheckbox" + checkedproperty).checked = true;
	} else if (firstproperty > -1) {
		document.getElementById("propertycheckbox" + firstproperty).checked = true;
	}
	var __rows = document.querySelectorAll(".property-cell-row");
	for (var __ri = 0; __ri < __rows.length; __ri++) {
		(function (row) {
			row.addEventListener("click", function () {
				// Toggle check the current checkbox.
				var ownInput = row.querySelector(".propertycellcheckbox > input");
				if (ownInput) ownInput.checked = !ownInput.checked;

				// Set all other checkboxes to false.
				var allInputs = document.querySelectorAll(".propertycellcheckbox > input");
				for (var k = 0; k < allInputs.length; k++) {
					if (!row.contains(allInputs[k])) allInputs[k].checked = false;
				}

				updateOption();
			});
		})(__rows[__ri]);
	}
	updateOption();
}

// "Nothing selected" view: show bank's remaining building inventory.
// Renders the global pool counters (32 houses / 12 hotels total).
function _renderBuildingsSummary() {
	UI.$hide("buyhousebutton");
	UI.$hide("sellhousebutton");
	UI.$hide("mortgagebutton");

	var housesum = 32, hotelsum = 12;
	for (var i = 0; i < 40; i++) {
		var s = square[i];
		if (s.hotel == 1) hotelsum--;
		else housesum -= s.house;
	}
	UI.$show("buildings");
	document.getElementById("buildings").innerHTML =
		"<img src='images/house.png' alt='' title='House' class='house' />:&nbsp;" + housesum +
		"&nbsp;&nbsp;<img src='images/hotel.png' alt='' title='Hotel' class='hotel' />:&nbsp;" + hotelsum;
}

// Render the manage panel for a property that's already mortgaged: only the
// unmortgage button is meaningful.
function _renderMortgagedOption(sq) {
	var unmortgageAmount = Math.round(sq.price * 0.55);
	var btn = document.getElementById("mortgagebutton");
	btn.value = t('manage.unmortgageValue', { amount: unmortgageAmount });
	btn.title = t('manage.unmortgageTitle', { place: sq.name, amount: unmortgageAmount });
	UI.$hide("buyhousebutton");
	UI.$hide("sellhousebutton");
}

// Render the manage panel for an owned, non-mortgaged property in a buildable
// group (street). Handles the even-build rule, mortgage availability, and the
// hotel-replaces-houses display tweak.
function _renderBuildingOptions(sq) {
	var buyhousebutton = document.getElementById("buyhousebutton");
	var sellhousebutton = document.getElementById("sellhousebutton");

	UI.$show("buyhousebutton");
	UI.$show("sellhousebutton");
	buyhousebutton.disabled = false;
	sellhousebutton.disabled = false;
	buyhousebutton.value  = t('manage.buyHouseValue',  { amount: sq.houseprice });
	sellhousebutton.value = t('manage.sellHouseValue', { amount: (sq.houseprice * 0.5) });
	buyhousebutton.title  = t('manage.buyHouseTitle',  { amount: sq.houseprice });
	sellhousebutton.title = t('manage.sellHouseTitle', { amount: (sq.houseprice * 0.5) });

	if (sq.house == 4) {
		buyhousebutton.value = t('manage.buyHotelValue', { amount: sq.houseprice });
		buyhousebutton.title = t('manage.buyHotelTitle', { amount: sq.houseprice });
	}
	if (sq.hotel == 1) {
		UI.$hide("buyhousebutton");
		sellhousebutton.value = t('manage.sellHotelValue', { amount: (sq.houseprice * 0.5) });
		sellhousebutton.title = t('manage.sellHotelTitle', { amount: (sq.houseprice * 0.5) });
	}

	// Scan the whole color group to learn the even-build / mortgage state.
	var maxhouse = 0, minhouse = 5;
	var allGroupUninproved = true, allGroupUnmortgaged = true;
	for (var i = 0; i < sq.group.length; i++) {
		var s = square[sq.group[i]];
		if (s.owner !== sq.owner) {
			buyhousebutton.disabled = true;
			sellhousebutton.disabled = true;
			buyhousebutton.title = t('manage.needOwnGroup');
			continue;
		}
		if (s.house > maxhouse) maxhouse = s.house;
		if (s.house < minhouse) minhouse = s.house;
		if (s.house > 0) allGroupUninproved = false;
		if (s.mortgage)  allGroupUnmortgaged = false;
	}

	if (!allGroupUnmortgaged) {
		buyhousebutton.disabled = true;
		buyhousebutton.title = t('manage.needUnmortgage');
	}

	// Force even building.
	if (sq.house > minhouse) {
		buyhousebutton.disabled = true;
		if (sq.house == 1)       buyhousebutton.title = t('manage.needOneEach');
		else if (sq.house == 4)  buyhousebutton.title = t('manage.need4Each');
		else                     buyhousebutton.title = t('manage.needNEach', { n: sq.house });
	}
	if (sq.house < maxhouse) {
		sellhousebutton.disabled = true;
		if (sq.house == 1) sellhousebutton.title = t('manage.sellNeedOne');
		else               sellhousebutton.title = t('manage.sellNeedN', { n: sq.house });
	}

	if (sq.house === 0 && sq.hotel === 0) {
		UI.$hide("sellhousebutton");
	} else {
		UI.$hide("mortgagebutton");
	}

	// Mortgage requires unimproved across the whole color group.
	if (!allGroupUninproved) {
		document.getElementById("mortgagebutton").title = t('manage.mortgageNeedUnimproved');
		document.getElementById("mortgagebutton").disabled = true;
	}
}

function updateOption() {
	UI.$show("option");
	var checkedproperty = getCheckedProperty();

	if (checkedproperty < 0 || checkedproperty >= 40) {
		_renderBuildingsSummary();
		return;
	}

	UI.$hide("buildings");
	var sq = square[checkedproperty];

	UI.$show("mortgagebutton");
	document.getElementById("mortgagebutton").disabled = false;

	if (sq.mortgage) {
		_renderMortgagedOption(sq);
	} else {
		document.getElementById("mortgagebutton").value = t('manage.mortgageValue', { amount: (sq.price * 0.5) });
		document.getElementById("mortgagebutton").title = t('manage.mortgageTitle', { place: sq.name, amount: (sq.price * 0.5) });

		if (sq.groupNumber >= 3) {
			_renderBuildingOptions(sq);
		} else {
			// Railroads / utilities: no buildings.
			UI.$hide("buyhousebutton");
			UI.$hide("sellhousebutton");
		}
	}

	// Re-sync color-group ownership halos on every owned-state change.
	if (typeof __refreshGroupVisuals === 'function') __refreshGroupVisuals();
}

