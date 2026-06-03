// =====================================================================
// animations.js — Sprint 5 split-out from monopoly.js.
// Visual / motion helpers: quickstats card, alert toasts, popup with
// auto-accept, auction bidder strip, cell hover deed preview, turn
// banner, roll pulse, ripple, deck flash, building/mortgage visuals,
// game-intro animation, floating money deltas, consequence preview,
// rent flight, free-parking pot collection, board flash, confetti,
// victory overlay, token layer (walk/snap), updatePosition, haptic,
// shake, zoom pulse.
// =====================================================================


// function show(element) {
	// // Element may be an HTML element or the id of one passed as a string.
	// if (element.constructor == String) {
		// element = document.getElementById(element);
	// }

	// if (element.tagName == "INPUT" || element.tagName == "SPAN" || element.tagName == "LABEL") {
		// element.style.display = "inline";
	// } else {
		// element.style.display = "block";
	// }
// }

// function hide(element) {
	// // Element may be an HTML element or the id of one passed as a string.
	// if (element.constructor == String) {
		// document.getElementById(element).style.display = "none";
	// } else {
		// element.style.display = "none";
	// }
// }

// =============================================================
// Quickstats panel — the small "current player" card inside the
// control section. Shows avatar, name, cash, and the cell they
// just landed on. Built lazily so updateMoney's frequent calls
// only mutate textContent.
// =============================================================
function __renderQuickStats(p) {
	var host = document.getElementById('quickstats');
	if (!host || !p) return;

	// Lazy-init the structure on first render.
	if (!host.querySelector('.qs-card')) {
		host.innerHTML = '';
		var card = document.createElement('div');
		card.className = 'qs-card';

		var avatar = document.createElement('div');
		avatar.className = 'qs-avatar';
		card.appendChild(avatar);

		var info = document.createElement('div');
		info.className = 'qs-info';

		var topLine = document.createElement('div');
		topLine.className = 'qs-name-row';
		var name = document.createElement('span');
		name.id = 'pname';
		topLine.appendChild(name);
		info.appendChild(topLine);

		var money = document.createElement('div');
		money.className = 'qs-money';
		var moneyVal = document.createElement('span');
		moneyVal.id = 'pmoney';
		money.appendChild(moneyVal);
		info.appendChild(money);

		var loc = document.createElement('div');
		loc.className = 'qs-loc';
		var locIcon = document.createElement('span');
		locIcon.className = 'qs-loc-icon';
		locIcon.textContent = '📍';
		loc.appendChild(locIcon);
		var locText = document.createElement('span');
		locText.className = 'qs-loc-text';
		loc.appendChild(locText);
		info.appendChild(loc);

		card.appendChild(info);
		host.appendChild(card);

		// Turn-order preview strip — small carousel of upcoming players.
		var order = document.createElement('div');
		order.className = 'qs-turn-order';
		host.appendChild(order);
	}

	// Avatar (PNG circle filled with player color).
	var av = host.querySelector('.qs-avatar');
	if (av) {
		av.style.backgroundColor = p.color;
		var file = '';
		if (p.avatar && window.GameConfig.avatarOptions) {
			for (var i = 0; i < window.GameConfig.avatarOptions.length; i++) {
				if (window.GameConfig.avatarOptions[i].id === p.avatar) {
					file = window.GameConfig.avatarOptions[i].file;
					break;
				}
			}
		}
		av.style.backgroundImage = file ? "url('" + file + "')" : '';
	}

	// Location: cell name where the player currently is.
	var locText = host.querySelector('.qs-loc-text');
	if (locText) {
		var cell = (typeof square !== 'undefined' && square[p.position]) ? square[p.position] : null;
		locText.textContent = p.jail
			? (typeof t === 'function' ? t('landed.inJail') : 'In Jail')
			: (cell ? cell.name : '');
	}

	// Turn order preview: show the next 3 upcoming players.
	var order = host.querySelector('.qs-turn-order');
	if (order && pcount > 1) {
		while (order.firstChild) order.removeChild(order.firstChild);
		var lbl = document.createElement('span');
		lbl.className = 'qs-turn-order-label';
		lbl.textContent = (typeof t === 'function' ? t('panel.upNext') : 'Up next:');
		order.appendChild(lbl);
		var max = Math.min(pcount - 1, 3);
		for (var k = 1; k <= max; k++) {
			var slot = ((turn - 1 + k) % pcount) + 1;
			var np = player[slot];
			if (!np) continue;
			var chip = document.createElement('span');
			chip.className = 'qs-turn-chip';
			chip.title = np.name;
			var dot = document.createElement('span');
			dot.className = 'qs-turn-chip-dot';
			dot.style.background = np.color;
			chip.appendChild(dot);
			var nm = document.createElement('span');
			nm.textContent = np.name;
			chip.appendChild(nm);
			order.appendChild(chip);
		}
	}
}

// Heuristic: pick an icon (emoji) for an alert string by looking at keywords
// in the most common alert templates. Lets the event log scan visually so
// users can quickly distinguish a dice roll from a rent payment from a card.
function __alertIcon(text) {
	if (!text) return '•';
	var s = text.toLowerCase();
	if (s.indexOf('roll') !== -1 || s.indexOf('tir') !== -1 || s.indexOf('dado') !== -1 || s.indexOf('dice') !== -1) return '🎲';
	if (s.indexOf('rent') !== -1 || s.indexOf('alquil') !== -1) return '💵';
	if (s.indexOf('bought') !== -1 || s.indexOf('compr') !== -1 || s.indexOf('purchas') !== -1) return '🏷️';
	if (s.indexOf('hotel') !== -1) return '🏨';
	if (s.indexOf('house') !== -1 || s.indexOf('casa') !== -1) return '🏠';
	if (s.indexOf('jail') !== -1 || s.indexOf('cárc') !== -1 || s.indexOf('carcel') !== -1) return '🚓';
	if (s.indexOf('mortgag') !== -1 || s.indexOf('hipotec') !== -1) return '📜';
	if (s.indexOf('chance') !== -1 || s.indexOf('suerte') !== -1) return '🎴';
	if (s.indexOf('community') !== -1 || s.indexOf('comunidad') !== -1 || s.indexOf('tesorer') !== -1) return '📦';
	if (s.indexOf('tax') !== -1 || s.indexOf('impuest') !== -1) return '⚖️';
	if (s.indexOf('salary') !== -1 || s.indexOf('go') !== -1 || s.indexOf('salida') !== -1) return '💰';
	if (s.indexOf('bankrupt') !== -1 || s.indexOf('quiebr') !== -1 || s.indexOf('resign') !== -1) return '☠️';
	if (s.indexOf('trade') !== -1 || s.indexOf('intercambi') !== -1) return '🤝';
	if (s.indexOf('turn') !== -1 || s.indexOf('turno') !== -1) return '▶';
	if (s.indexOf('landed') !== -1 || s.indexOf('caíste') !== -1 || s.indexOf('caiste') !== -1) return '📍';
	return '•';
}

// Track per-turn group so the event log can render a sticky divider when a
// new player starts their turn.
var __alertLastTurn = -1;

function addAlert(alertText) {
	var alertEl = document.getElementById("alert");
	var p = player[turn];

	// Mirror the entry into the persistent action-history panel (transparent
	// left-edge log). UI.historyLog handles its own turn dividers.
	if (typeof UI !== 'undefined' && UI.historyLog && p) {
		UI.historyLog(alertText, {
			turn: turn,
			color: p.color,
			playerName: p.name
		});
	}

	if (alertEl) {
		// Insert a thin "Turn X — Name" divider whenever the active player changes.
		if (turn !== __alertLastTurn && p) {
			__alertLastTurn = turn;
			var sep = document.createElement('div');
			sep.className = 'alert-turn-sep';
			var dot = document.createElement('span');
			dot.className = 'alert-turn-dot';
			dot.style.background = p.color;
			sep.appendChild(dot);
			sep.appendChild(document.createTextNode(p.name));
			alertEl.appendChild(sep);
		}

		var row = document.createElement('div');
		row.className = 'alert-row';
		var ic = document.createElement('span');
		ic.className = 'alert-icon';
		ic.textContent = __alertIcon(alertText);
		row.appendChild(ic);
		var msg = document.createElement('span');
		msg.className = 'alert-msg';
		msg.textContent = alertText;
		row.appendChild(msg);
		alertEl.appendChild(row);

		// Bound DOM growth on long games; oldest entries are scrolled out anyway.
		var maxEntries = 200;
		while (alertEl.children.length > maxEntries) {
			alertEl.removeChild(alertEl.firstChild);
		}

		// Smooth-scroll the alert log to the bottom (CSS scroll-behavior:smooth
		// inside index.html handles the easing — we just set the target).
		alertEl.scrollTop = alertEl.scrollHeight;
	}

	if (p && !p.human && p.AI) {
		// alertList is preserved for legacy AI internals; the visible UI is
		// now the action-history panel above, not the old popup recap.
		p.AI.alertList += "<div>" + I18N.escape(alertText) + "</div>";
		try {
			var maxChars = 8192;
			if (p.AI.alertList.length > maxChars) {
				p.AI.alertList = p.AI.alertList.slice(-maxChars);
			}
		} catch (e) { /* defensive: alertList missing on AI mock */ }
	}
}

// =====================================================================
// Auction UI helpers — render the bidders roster inside the auction
// popup, post toasts + alert-log entries when an AI player acts (instead
// of the native window.alert that used to chain through with each AI
// turn), and ask for confirmation before exiting via the styled popup
// instead of the browser confirm().
// =====================================================================

// Build/replace the <div id="auctionBidders"> contents based on the live
// `player[]` / `currentbidder` / `highestbidder` / `bidding` flags. Each
// entry is a colored chip showing the player's name, cash, and a status
// pill (active turn / passed / highest / out). Cheap to call repeatedly.
function __renderAuctionBidders() {
	var host = document.getElementById('auctionBidders');
	if (!host) return;
	var html = '';
	for (var i = 1; i <= pcount; i++) {
		var p = player[i]; if (!p) continue;
		var statusKey;
		if (!p.bidding) {
			statusKey = 'auction.statusOut';      // dropped out
		} else if (i === highestbidder) {
			statusKey = 'auction.statusHighest';  // currently winning
		} else if (i === currentbidder) {
			statusKey = 'auction.statusCurrent';  // their turn
		} else {
			statusKey = 'auction.statusWaiting';  // still in, not their turn
		}
		var statusLabel = (typeof t === 'function') ? t(statusKey) : statusKey;
		var rowClass = 'auction-bidder';
		if (i === currentbidder)  rowClass += ' auction-bidder-current';
		if (i === highestbidder)  rowClass += ' auction-bidder-highest';
		if (!p.bidding)           rowClass += ' auction-bidder-out';
		html +=
			'<div class="' + rowClass + '" style="--bidder-color:' + p.color + '">' +
				'<span class="auction-bidder-dot" style="background:' + p.color + '"></span>' +
				'<span class="auction-bidder-name">' + I18N.escape(p.name) + '</span>' +
				'<span class="auction-bidder-cash">$' + p.money + '</span>' +
				'<span class="auction-bidder-status">' + I18N.escape(statusLabel) + '</span>' +
			'</div>';
	}
	host.innerHTML = html;
}

// Surface an AI auction action without blocking the game flow. Posts to
// the alert log (so it persists in scrollback) AND a brief toast (so the
// table sees it). `kind` maps to toast accent: success / warning / info.
function __auctionAnnounce(message, kind) {
	if (typeof addAlert === 'function') addAlert(message);
	if (typeof UI !== 'undefined' && UI.toast) UI.toast(message, { kind: kind || 'info', duration: 1800 });
}

// Replace the native confirm() dialog with the styled popup yes/no.
// IMPORTANT: while the confirmation popup is open we DON'T tear down the
// auction popup — popup() reuses the same #popup element, so we capture
// the auction HTML, rebuild it once the user resolves, and re-open it.
function __confirmAuctionExit() {
	var popupEl  = document.getElementById('popup');
	var savedHTML = document.getElementById('popuptext').innerHTML;
	var savedClasses = popupEl.className;
	var confirmMsg = '<p><strong>' + I18N.escape(t('popup.confirmExitAuction')) + '</strong></p>';
	popup(confirmMsg, function () {
		// User pressed Yes → exit auction (also closes popup natively).
		game.auctionExit();
	}, 'Yes/No');
	// On No, popup() will hide the popup; we need to re-show the auction.
	// Hook into #popupno to restore instead of letting the auction die.
	var noBtn = document.getElementById('popupno');
	if (noBtn) {
		noBtn.addEventListener('click', function restore() {
			noBtn.removeEventListener('click', restore);
			// Re-show the auction popup with its captured HTML/classes.
			document.getElementById('popuptext').innerHTML = savedHTML;
			popupEl.className = savedClasses;
			UI.$fadeIn('popupbackground', 200);
			UI.$show('popupwrap');
			__renderAuctionBidders();
		});
	}
}

// (AI turn recap removed — events are streamed live into the persistent
// #action-history panel rendered by UI.historyLog from addAlert().)

// =====================================================================
// Auto-roll countdown — keeps the game flowing when a player wanders off
// or forgets it's their turn. Arms when play() detects a human's roll
// phase; visible badge counts down once per second on the "Tirar dados"
// button; ANY interaction with the dice / button / movement input cancels
// the timer. When it hits zero, the same code path the human would
// trigger fires (game.next() → roll()).
// Configurable via window.GameConfig.autoRollMs (default 20s). Set <= 0 to
// disable (e.g. for a relaxed local game).
// =====================================================================
var __autoRollInterval = null;
var __autoRollListenersBound = false;
var __AUTO_ROLL_MS_DEFAULT = 20000;

function __getAutoRollMs() {
	var v = (typeof window !== 'undefined') ? window.GameConfig.autoRollMs : undefined;
	if (typeof v === 'number') return v;
	return __AUTO_ROLL_MS_DEFAULT;
}

function __armAutoRoll() {
	__cancelAutoRoll();
	var totalMs = __getAutoRollMs();
	if (totalMs <= 0) return;
	var btn = document.getElementById('nextbutton');
	if (!btn) return;
	// Only arm while the button is in "Roll Dice" state. Once a roll is
	// underway and the label flips to "End turn" or "Roll again", the
	// human is supposed to react to game state, not stand idle.
	var rollLabel = (typeof t === 'function') ? t('ui.rollDice') : 'Roll Dice';
	if (btn.value !== rollLabel) return;
	var sec = Math.ceil(totalMs / 1000);
	btn.classList.add('auto-roll-armed');
	btn.style.setProperty('--auto-pct', '100%');
	// Inject the floating badge once (idempotent if called twice).
	var badge = document.getElementById('autoRollBadge');
	if (!badge) {
		badge = document.createElement('span');
		badge.id = 'autoRollBadge';
		badge.className = 'auto-roll-badge';
		btn.parentNode.style.position = 'relative';
		btn.parentNode.appendChild(badge);
	}
	badge.classList.remove('dim');
	badge.textContent = sec;
	// Next animation frame so the browser sees the 100% start width before
	// we transition to the next bucket (otherwise the bar appears empty).
	requestAnimationFrame(function () {
		var pct = ((sec - 1) / sec) * 100;
		btn.style.setProperty('--auto-pct', pct + '%');
	});
	__bindAutoRollCancel();
	__autoRollInterval = setInterval(function () {
		sec -= 1;
		if (sec <= 0) {
			__cancelAutoRoll(true); // dim and clear visuals before triggering
			// Use game.next() so it goes through the standard walking-guard.
			if (typeof game !== 'undefined' && game.next) game.next();
			return;
		}
		badge.textContent = sec;
		var pct = (sec / Math.ceil(__getAutoRollMs() / 1000)) * 100;
		btn.style.setProperty('--auto-pct', pct + '%');
	}, 1000);
}

function __cancelAutoRoll(silent) {
	if (__autoRollInterval) { clearInterval(__autoRollInterval); __autoRollInterval = null; }
	var btn = document.getElementById('nextbutton');
	if (btn) {
		btn.classList.remove('auto-roll-armed');
		btn.style.removeProperty('--auto-pct');
	}
	var badge = document.getElementById('autoRollBadge');
	if (badge) {
		if (silent) {
			badge.classList.add('dim');
			setTimeout(function () { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 250);
		} else {
			if (badge.parentNode) badge.parentNode.removeChild(badge);
		}
	}
}

// Bind cancel handlers ONCE. Any meaningful interaction (clicking the
// roll button, grabbing a die, pressing space/enter, hovering long enough
// to read the situation) clears the auto timer. We capture-phase listen so
// we run before normal handlers; cancelling never blocks the original
// gesture (we don't preventDefault).
function __bindAutoRollCancel() {
	if (__autoRollListenersBound) return;
	__autoRollListenersBound = true;
	function cancel() { __cancelAutoRoll(); }
	['mousedown', 'touchstart', 'keydown'].forEach(function (ev) {
		document.addEventListener(ev, function (e) {
			// Don't cancel on key-repeat (typing in setup name input etc.).
			if (e.type === 'keydown' && e.repeat) return;
			cancel();
		}, true);
	});
}

// popup(HTML, action, option, opts)
//   HTML   — innerHTML for #popuptext
//   action — function: callback when the user (or auto-timer) accepts.
//            String form sets `option` (legacy: popup(html, "yes/no")).
//   option — "yes/no" | "blank" | unset → builds Yes+No / no buttons / OK
//   opts   — { autoMs, autoLabel } : auto-accept timer
//       autoMs: arm an N-millisecond countdown ring next to the primary
//               button. When it elapses, the primary action runs as if the
//               user clicked. Any user click (yes/no/OK) cancels the timer
//               cleanly. autoMs ≤ 0 disables.
//       autoLabel: optional override for the "Auto-aceptar en…" string.
//
// The countdown ring is a pure-CSS SVG circle (see .auto-accept-ring in
// styles.css). One setInterval ticks the number once per second; on each
// tick the stroke-dashoffset is recalculated so the visual drain stays in
// lockstep with the displayed seconds.
function popup(HTML, action, option, opts) {
	opts = opts || {};
	// Each popup() invocation starts from the default entrance animation.
	// Callers (chanceCommunityChest) opt into the card-flip variant by adding
	// .popup-card AFTER popup() returns.
	document.getElementById("popup").classList.remove("popup-card");
	document.getElementById("popuptext").innerHTML = HTML;
	document.getElementById("popup").style.width = "";   // let CSS sizing rule rule
	document.getElementById("popup").style.top = "0px";
	document.getElementById("popup").style.left = "0px";

	if (!option && typeof action === "string") {
		option = action;
	}

	option = option ? option.toLowerCase() : "";

	if (typeof action !== "function") {
		action = null;
	}

	// Cancel any pending auto-accept from a previous popup (rare but possible
	// if a second popup opens before the first one's timer fired).
	if (window.GameState.popupAutoTimer) {
		clearInterval(window.GameState.popupAutoTimer);
		window.GameState.popupAutoTimer = null;
	}

	// Remember which element had focus before the popup opened so we can
	// restore it on close. Without this, keyboard users land on <body> and
	// lose their place in the UI flow.
	var prevFocus = document.activeElement;
	function restoreFocus() {
		if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) {
			try { prevFocus.focus(); } catch (e) {}
		}
	}

	// Yes/No
	if (option === "yes/no") {
		document.getElementById("popuptext").innerHTML += "<div><input type=\"button\" value=\"" + I18N.escape(t('ui.yes')) + "\" id=\"popupyes\" /><input type=\"button\" value=\"" + I18N.escape(t('ui.no')) + "\" id=\"popupno\" /></div>";

		var __closeYesNo = function () {
			__popupCancelAuto();
			UI.$hide("popupwrap");
			UI.$fadeOut("popupbackground", 400, restoreFocus);
		};
		UI.$on("popupyes", "click", __closeYesNo);
		UI.$on("popupno", "click", __closeYesNo);

		if (action) UI.$on("popupyes", "click", action);

	// Ok
	} else if (option !== "blank") {
		var __popuptext = document.getElementById("popuptext");
		__popuptext.insertAdjacentHTML("beforeend", "<div><input type='button' value='" + I18N.escape(t('ui.ok')) + "' id='popupclose' /></div>");
		var __closeBtn = document.getElementById("popupclose");
		if (__closeBtn) {
			__closeBtn.focus();
			__closeBtn.addEventListener("click", function () {
				__popupCancelAuto();
				UI.$hide("popupwrap");
				UI.$fadeOut("popupbackground", 400, restoreFocus);
			});
			if (action) __closeBtn.addEventListener("click", action);
		}

	}

	// Show using animation.
	UI.$fadeIn("popupbackground", 400, function () {
		UI.$show("popupwrap");
	});

	// === Auto-accept timer ===
	// Attach the countdown ring + tick the seconds. The "primary" button is
	// the one whose click should fire the action: #popupyes for yes/no, or
	// #popupclose for the default OK. The chance-card popup (option=="blank"
	// + .popup-card) skips this because callers explicitly add their own OK
	// later; chanceCommunityChest() reattaches the ring after that.
	if (opts.autoMs && opts.autoMs > 0 && option !== "blank") {
		__popupArmAutoAccept(opts.autoMs, opts.autoLabel);
	}
}

// Build the SVG ring + numeric counter and append to #popuptext. Returns
// the DOM nodes so chanceCommunityChest can move them next to its own OK.
function __popupBuildAutoRow(seconds, labelOverride) {
	var label = labelOverride || t('ui.autoAcceptLabel') || 'Se acepta solo en…';
	var hint  = t('ui.autoAcceptHint') || 'Pulsa cualquier botón para cancelar';
	// SVG: circle radius 22 → circumference 2 × π × 22 = 138.23
	var html =
		'<div class="auto-accept-row" id="popupAutoRow">' +
			'<div class="auto-accept-ring" id="popupAutoRing">' +
				'<svg viewBox="0 0 48 48" aria-hidden="true">' +
					'<circle class="auto-track" cx="24" cy="24" r="22" />' +
					'<circle class="auto-bar"   cx="24" cy="24" r="22" />' +
				'</svg>' +
				'<span class="auto-num" id="popupAutoNum">' + seconds + '</span>' +
			'</div>' +
			'<div class="auto-accept-label">' +
				I18N.escape(label) +
				'<span class="auto-hint">' + I18N.escape(hint) + '</span>' +
			'</div>' +
		'</div>';
	var wrap = document.createElement('div');
	wrap.innerHTML = html;
	return wrap.firstChild;
}

function __popupArmAutoAccept(autoMs, labelOverride) {
	var totalSec = Math.max(1, Math.ceil(autoMs / 1000));
	var row = __popupBuildAutoRow(totalSec, labelOverride);
	document.getElementById('popuptext').appendChild(row);

	var ring   = document.getElementById('popupAutoRing');
	var numEl  = document.getElementById('popupAutoNum');
	var barEl  = ring ? ring.querySelector('.auto-bar') : null;
	if (!ring || !numEl || !barEl) return;

	var CIRC = 138.23;
	var remaining = totalSec;
	barEl.style.transitionDuration = '1s';
	barEl.style.strokeDashoffset = '0';

	// Pick the primary button. Yes/No → popupyes. OK → popupclose.
	function primaryClick() {
		var btn = document.getElementById('popupyes') || document.getElementById('popupclose');
		if (btn) btn.click();
	}

	window.GameState.popupAutoTimer = setInterval(function () {
		remaining -= 1;
		if (remaining <= 0) {
			__popupCancelAuto();    // stop the timer first so the click handler
			primaryClick();         // doesn't try to cancel a dead timer
			return;
		}
		numEl.textContent = remaining;
		barEl.style.strokeDashoffset = ((totalSec - remaining) / totalSec) * CIRC;
	}, 1000);
}

// Cancel an in-flight auto-accept (called by every cancel/accept click).
// Visible state: ring greys out so the user knows their interaction killed
// the timer before they look away.
function __popupCancelAuto() {
	if (window.GameState.popupAutoTimer) {
		clearInterval(window.GameState.popupAutoTimer);
		window.GameState.popupAutoTimer = null;
	}
	var ring = document.getElementById('popupAutoRing');
	if (ring) ring.classList.add('auto-cancelled');
}


// === Tokens (per-cell DOM rendering) ===
// 8 persistent token <div>s, one per player. Each token is RE-PARENTED to
// the cell-position-holder of the player's current cell on every updatePosition.
// This guarantees tokens live INSIDE the actual cell DOM, so they can never
// drift outside the cell visually regardless of browser table-layout quirks.
// (We give up the smooth slide-between-cells animation that the persistent
// overlay-layer approach provided.)

// Tokens registry: declared as a property of GameState so the namespace shim
// doesn't fire its deprecation warning. Bare reads via `__tokens[i]` still
// work because the shim's getter on window.__tokens proxies through.
window.GameState.tokens = window.GameState.tokens || {};
var __tokens = window.GameState.tokens; // local alias kept for readability
var __tokensInitialized = false;

// =============================================================
// UI polish helpers — board hover preview, color-group highlight,
// turn banner, roll-dice pulse, button ripple, event toasts.
// =============================================================

// Show the deed tooltip for a board cell, positioned near the cursor.
// Suppresses for non-property cells (corners, tax, etc.).
function __cellHoverEnter(cellIdx, mouseEvent) {
	var sq = square[cellIdx];
	if (!sq || sq.groupNumber === 0) return; // only properties + railroads + utilities

	// Show the deed near the cursor (clamp to viewport).
	showdeed(cellIdx);
	var deed = document.getElementById('deed');
	if (deed && mouseEvent) {
		var top  = mouseEvent.clientY + 18;
		var left = mouseEvent.clientX + 14;
		if (top + 279 > window.innerHeight) top = window.innerHeight - 285;
		if (left + 235 > window.innerWidth) left = mouseEvent.clientX - 250;
		deed.style.top  = top + 'px';
		deed.style.left = left + 'px';
	}

	// Glow every other cell that shares the color group.
	if (sq.groupNumber >= 3 && sq.group) {
		for (var j = 0; j < sq.group.length; j++) {
			var gcEl = document.getElementById('cell' + sq.group[j]);
			if (gcEl) gcEl.classList.add('cell-group-hover');
		}
	}
}

function __cellHoverLeave(cellIdx) {
	hidedeed();
	var sq = square[cellIdx];
	if (sq && sq.groupNumber >= 3 && sq.group) {
		for (var j = 0; j < sq.group.length; j++) {
			var gcEl = document.getElementById('cell' + sq.group[j]);
			if (gcEl) gcEl.classList.remove('cell-group-hover');
		}
	}
}

// Floats a "Turn: Name" banner from the top of the stage for ~1.8s.
function __showTurnBanner(p) {
	var stage = document.getElementById('game-stage');
	if (!stage || !p) return;
	var old = document.getElementById('turn-banner');
	if (old && old.parentNode) old.parentNode.removeChild(old);

	var banner = document.createElement('div');
	banner.id = 'turn-banner';
	var dot = document.createElement('span');
	dot.className = 'tb-dot';
	dot.style.backgroundColor = p.color;
	banner.appendChild(dot);
	var label = document.createElement('span');
	label.textContent = (typeof t === 'function' ? t('alert.isYourTurn', { player: p.name }) : p.name);
	banner.appendChild(label);
	// Screen-reader equivalent: assertive announcement so keyboard-only and
	// blind players don't depend on seeing the visual banner.
	if (window.UI && typeof UI.announceUrgent === 'function') UI.announceUrgent(label.textContent);
	stage.appendChild(banner);
	setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 1900);
}

// Toggle a "waiting on this player" pulse on the Roll Dice button.
function __setRollPulse(on) {
	var btn = document.getElementById('nextbutton');
	if (!btn) return;
	if (on) btn.classList.add('btn-pulse-attn');
	else    btn.classList.remove('btn-pulse-attn');
}

// Material-style ripple on any input[type=button] click.
function __spawnRipple(btn, e) {
	var rect = btn.getBoundingClientRect();
	var size = Math.max(rect.width, rect.height);
	var r = document.createElement('span');
	r.className = 'btn-ripple';
	r.style.width = size + 'px';
	r.style.height = size + 'px';
	r.style.left = (e.clientX - rect.left - size / 2) + 'px';
	r.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
	btn.appendChild(r);
	setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 600);
}

// Brief "card lifted from the pile" animation when a player draws.
// Adds the .center-deck-flash class, removes it on animationend so the
// CSS keyframe can re-trigger on subsequent draws.
function __flashDeck(id) {
	var el = document.getElementById(id);
	if (!el) return;
	el.classList.remove('center-deck-flash');
	void el.offsetWidth; // force reflow so re-adding restarts the animation
	el.classList.add('center-deck-flash');
	var handler = function () {
		el.classList.remove('center-deck-flash');
		el.removeEventListener('animationend', handler);
	};
	el.addEventListener('animationend', handler);
	setTimeout(function () {
		el.classList.remove('center-deck-flash');
		el.removeEventListener('animationend', handler);
	}, 700);
}

// Render the houses/hotels visible on the board for one property cell.
// Called after buyHouse / sellHouse and during initial setup.
function __updateBuildings(propIdx) {
	var sq = square[propIdx];
	if (!sq || sq.groupNumber < 3) return;
	var container = document.getElementById('cell' + propIdx + 'buildings');
	if (!container) return;
	while (container.firstChild) container.removeChild(container.firstChild);
	if (sq.hotel) {
		var hot = document.createElement('div');
		hot.className = 'cell-building cell-hotel';
		hot.title = 'Hotel';
		container.appendChild(hot);
	} else if (sq.house > 0) {
		for (var i = 0; i < sq.house; i++) {
			var h = document.createElement('div');
			h.className = 'cell-building';
			h.title = 'House';
			container.appendChild(h);
		}
	}
}

// Toggle the mortgaged stripe overlay on a property cell (CSS-driven via
// the data-mortgaged attribute on the <td>).
function __updateMortgagedVisual(propIdx) {
	var cellEl = document.getElementById('cell' + propIdx);
	if (!cellEl) return;
	if (square[propIdx].mortgage) cellEl.setAttribute('data-mortgaged', 'true');
	else                          cellEl.removeAttribute('data-mortgaged');
}

// ===========================================================================
// Game-start intro: scales the board in with a 3D tilt + sweeping shine,
// then drops every active player's token into GO. Runs once per game.
// ===========================================================================
function __playGameIntro() {
	var stage = document.getElementById('game-stage');
	var board = document.getElementById('board');
	if (!stage || !board) return;

	stage.classList.remove('stage-intro');
	board.classList.remove('board-intro');
	void stage.offsetWidth;
	stage.classList.add('stage-intro');
	board.classList.add('board-intro');

	setTimeout(function () {
		stage.classList.remove('stage-intro');
		board.classList.remove('board-intro');
	}, 1200);

	// Splash banner — short "GAME ON" using i18n.
	var splash = document.createElement('div');
	splash.id = 'intro-splash';
	splash.textContent = (typeof t === 'function' ? t('ui.gameOn') : 'GAME ON');
	stage.appendChild(splash);
	setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 1600);

	// Mark each visible token so its first placement uses the drop-in keyframe
	// (handled in __placeTokenInCell).
	for (var i = 1; i <= pcount; i++) {
		var tok = __tokens && __tokens[i];
		if (tok) tok.__pendingDrop = true;
	}
}

// Floating "+$200" / "-$50" label that drifts up from a money element and fades.
// Anchored to #game-stage so coordinates are in the same stage-local space the
// element was laid out in (the stage's CSS transform applies uniformly).
function __floatMoneyDelta(el, delta) {
	if (!el || !delta) return;
	var stage = document.getElementById('game-stage');
	if (!stage) return;
	var elRect = el.getBoundingClientRect();
	var stageRect = stage.getBoundingClientRect();
	var scale = (window.GameState.stageTx && window.GameState.stageTx.scale) || 1;
	// Translate viewport coords back into stage-local coords.
	var left = (elRect.left + elRect.width / 2 - stageRect.left) / scale - 30;
	var top  = (elRect.top  - stageRect.top)  / scale - 6;

	var f = document.createElement('div');
	f.className = 'money-floater ' + (delta > 0 ? 'money-floater-up' : 'money-floater-down');
	f.textContent = (delta > 0 ? '+$' : '-$') + Math.abs(delta);
	f.style.left = left + 'px';
	f.style.top  = top + 'px';
	stage.appendChild(f);
	setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1200);
}

// =============================================================
// Consequence preview tooltip — shows next to an action button
// summarizing how the player's cash changes if they confirm.
// Used by buy/mortgage/build hover handlers.
// =============================================================
function __ensureConsequenceTip() {
	var tip = document.getElementById('consequence-tip');
	if (tip) return tip;
	tip = document.createElement('div');
	tip.id = 'consequence-tip';
	tip.setAttribute('role', 'tooltip');
	document.body.appendChild(tip);
	return tip;
}

function __showConsequencePreview(anchorEl, current, delta, warnThreshold) {
	if (!anchorEl) return;
	var tip = __ensureConsequenceTip();
	var after = current + delta;
	var sign = delta >= 0 ? '+' : '-';
	var deltaTxt = sign + '$' + Math.abs(delta);
	var status = '';
	if (after < 0) {
		status = 'danger';
	} else if (warnThreshold !== undefined && after < warnThreshold) {
		status = 'warn';
	}
	var lblCurrent = (typeof t === 'function' ? t('preview.current') : 'Now');
	var lblAfter   = (typeof t === 'function' ? t('preview.after')   : 'After');
	var note = '';
	if (after < 0) note = (typeof t === 'function' ? t('preview.cantAfford') : "You can't afford this.");
	else if (status === 'warn') note = (typeof t === 'function' ? t('preview.lowCash') : 'Low cash buffer.');

	tip.className = 'consequence-tip consequence-tip-' + (status || 'ok');
	tip.innerHTML =
		'<div class="ct-row"><span class="ct-label">' + lblCurrent + '</span><span class="ct-amt">$' + current + '</span></div>' +
		'<div class="ct-row ct-delta"><span class="ct-label">' + (delta >= 0 ? '+' : '−') + '</span><span class="ct-amt">' + deltaTxt + '</span></div>' +
		'<div class="ct-row ct-after"><span class="ct-label">' + lblAfter + '</span><span class="ct-amt">$' + after + '</span></div>' +
		(note ? '<div class="ct-note">' + note + '</div>' : '');

	var r = anchorEl.getBoundingClientRect();
	tip.style.display = 'block';
	requestAnimationFrame(function () {
		var tr = tip.getBoundingClientRect();
		var top  = r.top - tr.height - 10;
		var left = r.left + r.width / 2 - tr.width / 2;
		if (top < 8) top = r.bottom + 10;
		left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
		tip.style.top = top + 'px';
		tip.style.left = left + 'px';
		tip.classList.add('consequence-tip-visible');
	});
}

function __hideConsequencePreview() {
	var tip = document.getElementById('consequence-tip');
	if (tip) {
		tip.classList.remove('consequence-tip-visible');
		tip.style.display = 'none';
	}
}

// Wrapper invoked from inline onmouseenter on the dynamic buy button.
function __previewBuyConsequence(btn, price) {
	var p = player[turn];
	if (!p) return;
	__showConsequencePreview(btn, p.money, -Math.abs(price), 200);
}

window.__previewBuyConsequence = __previewBuyConsequence;
window.__hideConsequencePreview = __hideConsequencePreview;

// Arcs a "$N" pill from one player's token to another player's money-bar row.
// Used when rent is paid so the transfer of cash is visible. Pure DOM +
// transform animation, auto-cleans after settling.
function __animateRentFlight(fromSlot, toSlot, amount) {
	if (!amount || fromSlot === toSlot) return;
	var fromTok = __tokens && __tokens[fromSlot];
	var toRow = document.getElementById('p' + toSlot + 'moneybar');
	if (!fromTok || !fromTok.el || !toRow) return;

	var fromRect = fromTok.el.getBoundingClientRect();
	var toRect   = toRow.getBoundingClientRect();
	if (!fromRect.width || !toRect.width) return;

	var pill = document.createElement('div');
	pill.className = 'rent-flight';
	pill.textContent = '$' + amount;
	document.body.appendChild(pill);

	var startX = fromRect.left + fromRect.width / 2;
	var startY = fromRect.top  + fromRect.height / 2;
	var endX   = toRect.left   + toRect.width / 2;
	var endY   = toRect.top    + toRect.height / 2;
	// Place at start
	pill.style.left = (startX - 24) + 'px';
	pill.style.top  = (startY - 14) + 'px';
	pill.style.setProperty('--travel-x', (endX - startX) + 'px');
	pill.style.setProperty('--travel-y', (endY - startY) + 'px');
	// Arc apex offset (upward, midpoint).
	pill.style.setProperty('--arc-y', '-80px');
	// Trigger keyframes (CSS handles fly + fade).
	setTimeout(function () {
		if (pill.parentNode) pill.parentNode.removeChild(pill);
	}, 1100);
}
window.__animateRentFlight = __animateRentFlight;

// House-rule: Free Parking jackpot badge. Renders / updates a small gold
// pill above Free Parking (cell 20) showing the current pot. Removed when
// pot is empty or the rule is off.
function __updateFPBadge() {
	var fpCell = document.getElementById('cell20');
	if (!fpCell) return;
	var rule = window.GameConfig.houseRules && window.GameConfig.houseRules.freeParkingJackpot;
	var pot = window.GameState.freeParkingPot || 0;
	var badge = document.getElementById('fp-pot-badge');
	if (!rule || pot <= 0) {
		if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
		return;
	}
	if (!badge) {
		badge = document.createElement('div');
		badge.id = 'fp-pot-badge';
		badge.className = 'cell-fp-pot';
		fpCell.appendChild(badge);
	}
	badge.textContent = '$' + pot;
}
window.__updateFPBadge = __updateFPBadge;

// House-rule: collect the Free Parking pot when landing on cell 20.
function __collectFPPot(p) {
	if (!window.GameConfig.houseRules || !window.GameConfig.houseRules.freeParkingJackpot) return;
	var pot = window.GameState.freeParkingPot || 0;
	if (pot <= 0) return;
	p.money += pot;
	window.GameState.freeParkingPot = 0;
	addAlert(t('alert.freeParkingWin', { player: p.name, amount: pot }));
	if (typeof UI !== 'undefined') {
		UI.toast(t('alert.freeParkingWin', { player: p.name, amount: pot }), { kind: 'success' });
	}
	if (typeof Sound !== 'undefined' && Sound.coin) Sound.coin();
	updateMoney();
	__updateFPBadge();
}
window.__collectFPPot = __collectFPPot;

// One-shot pulse animation on a property cell when its ownership changes.
// Color is the new owner's player color, applied via a CSS variable so the
// keyframe can use it for the glow.
function __pulsePurchasedCell(idx, color) {
	var el = document.getElementById('cell' + idx);
	if (!el) return;
	el.style.setProperty('--purchase-color', color || '#1B5E3F');
	el.classList.remove('cell-purchase-pulse');
	void el.offsetWidth; // restart animation
	el.classList.add('cell-purchase-pulse');
	setTimeout(function () {
		el.classList.remove('cell-purchase-pulse');
	}, 900);
}
window.__pulsePurchasedCell = __pulsePurchasedCell;

// Highlights a board cell with a gold pulse — called from the stats modal
// when hovering a property name in a player's portfolio. Lets the user
// quickly locate a property on the board without scrolling visually.
window.__highlightBoardCell = function (idx, on) {
	var el = document.getElementById('cell' + idx);
	if (!el) return;
	if (on) el.classList.add('cell-stats-hover');
	else    el.classList.remove('cell-stats-hover');
};

// Setup presets — quick/standard/long. Tweaks starting cash and stores it
// on window.GameConfig.startingCash; setup() reads from there when
// instantiating players. The visible selection lives on the
// <select id="preset-select"> directly; no button highlighting needed.
window.__applyPreset = function (kind) {
	var amount = 1500;
	if (kind === 'quick') amount = 1000;
	else if (kind === 'long') amount = 2500;
	window.GameConfig.startingCash = amount;
};

// Triggered by the "Auction now" button on the landed-on-unowned-property UI.
// Effectively: skip buying and immediately start the auction for this tile.
// The tile is already queued via game.addPropertyToAuctionQueue() in land().
window.__startAuctionFromLanded = function () {
	// Hide the buy/auction prompts and kick off the auction.
	UI.$hide('landed');
	UI.$hide('buy');
	window.GameState.pendingBuyDecision = false;
	if (game && typeof game.auction === 'function') game.auction();
};

// Brief flash on the board frame using the active player's color.
function __flashBoardTurn(color) {
	var board = document.getElementById('board');
	if (!board) return;
	board.style.setProperty('--turn-color', color || 'var(--accent-bright)');
	board.classList.remove('board-turn-flash');
	void board.offsetWidth;
	board.classList.add('board-turn-flash');
	setTimeout(function () { board.classList.remove('board-turn-flash'); }, 720);
}

// Visual celebration when a player wins. Pure DOM + CSS keyframes; auto-cleans
// up after the longest animation finishes (~3.5 s).
function __launchConfetti() {
	var container = document.createElement('div');
	container.className = 'confetti';
	var palette = ['#FFD700', '#FF6347', '#4169E1', '#32CD32', '#FF1493', '#00CED1', '#FFA500', '#DA70D6'];
	for (var i = 0; i < 60; i++) {
		var piece = document.createElement('div');
		piece.className = 'confetti-piece';
		piece.style.left = (Math.random() * 100) + '%';
		piece.style.backgroundColor = palette[i % palette.length];
		piece.style.width = (5 + Math.floor(Math.random() * 6)) + 'px';
		piece.style.height = (10 + Math.floor(Math.random() * 10)) + 'px';
		piece.style.animationDelay = (Math.random() * 0.8) + 's';
		piece.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
		container.appendChild(piece);
	}
	document.body.appendChild(container);
	setTimeout(function () { if (container.parentNode) container.parentNode.removeChild(container); }, 4500);
}

// ============================================================
// Sprint 3 (S3.2) — Monopoly-completed confetti burst.
// SVG-rect particles with rAF-driven physics (gravity + initial
// velocity + rotation + fade). Anchored to the viewport position
// of centerEl (typically the cell that just closed the group).
// Honors prefers-reduced-motion (early return) and throttles
// particle count on mobile/low-core devices.
// ============================================================
function __burstConfetti(centerEl, colors) {
	if (!centerEl) return;
	// Reduced-motion users get no confetti at all — the deal is they
	// don't see fireworks, the game still gives them the audio/toast.
	try {
		if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	} catch (e) {}

	colors = colors && colors.length ? colors : ['#1B5E3F', '#FFD24A', '#FFFFFF'];

	// Anchor at the viewport center of the source element. getBoundingClientRect
	// already returns viewport-relative coords, which is exactly what a
	// position:fixed layer needs.
	var rect = centerEl.getBoundingClientRect();
	var ox = rect.left + rect.width / 2;
	var oy = rect.top  + rect.height / 2;

	// Particle budget: full burst on desktop, halved on small/low-end devices.
	var lowEnd = false;
	try {
		var hc = navigator && navigator.hardwareConcurrency;
		if ((typeof hc === 'number' && hc < 4) || window.innerWidth < 800) lowEnd = true;
	} catch (e) {}
	var COUNT = lowEnd ? 40 : 80;

	var SVG_NS = 'http://www.w3.org/2000/svg';
	var layer = document.createElement('div');
	layer.className = 'confetti-burst-layer';
	layer.setAttribute('aria-hidden', 'true');
	document.body.appendChild(layer);

	var particles = [];
	for (var i = 0; i < COUNT; i++) {
		var svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('width',  '6');
		svg.setAttribute('height', '6');
		svg.setAttribute('viewBox', '0 0 6 6');
		svg.setAttribute('class', 'confetti-burst-piece');
		var r = document.createElementNS(SVG_NS, 'rect');
		r.setAttribute('width',  '6');
		r.setAttribute('height', '6');
		r.setAttribute('fill', colors[i % colors.length]);
		svg.appendChild(r);
		svg.style.left = (ox - 3) + 'px';
		svg.style.top  = (oy - 3) + 'px';
		layer.appendChild(svg);
		particles.push({
			el:  svg,
			x:   0,
			y:   0,
			vx:  (Math.random() * 400) - 200,        // -200..200 px/s
			vy:  -100 - Math.random() * 300,         // -400..-100 px/s
			rot: Math.random() * 360,
			vr:  (Math.random() * 720) - 360         // -360..360 deg/s
		});
	}

	var GRAVITY     = 800;   // px/s²
	var FADE_AFTER  = 1500;  // ms — start fading
	var LIFE        = 2500;  // ms — auto-remove
	var startTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
	var lastTs = startTs;

	function frame(nowTs) {
		if (!nowTs) nowTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
		var dt = Math.min(0.05, (nowTs - lastTs) / 1000); // clamp dt — tab-switch can produce a huge delta
		lastTs = nowTs;
		var elapsed = nowTs - startTs;

		var fade = 1;
		if (elapsed > FADE_AFTER) {
			fade = 1 - ((elapsed - FADE_AFTER) / (LIFE - FADE_AFTER));
			if (fade < 0) fade = 0;
		}

		for (var k = 0; k < particles.length; k++) {
			var p = particles[k];
			p.vy += GRAVITY * dt;
			p.x  += p.vx * dt;
			p.y  += p.vy * dt;
			p.rot += p.vr * dt;
			p.el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) rotate(' + p.rot.toFixed(1) + 'deg)';
			p.el.style.opacity = fade;
		}

		if (elapsed < LIFE) {
			requestAnimationFrame(frame);
		} else {
			if (layer.parentNode) layer.parentNode.removeChild(layer);
		}
	}
	requestAnimationFrame(frame);

	// Hard safety net in case rAF stalls (background tab, etc.).
	setTimeout(function () {
		if (layer.parentNode) layer.parentNode.removeChild(layer);
	}, LIFE + 500);
}
window.__burstConfetti = __burstConfetti;

// Inline check — does playerIndex now own every property in `sq`'s color
// group? Intentionally NOT a wrapper around ai.js helpers; the rule is
// trivially simple and the dependency would couple celebration to AI code.
// Railroads/utilities are excluded (groupNumber 1/2 don't trigger monopoly
// confetti — those use the regular purchased-cell pulse only).
function __completesColorGroupNow(sq, playerIndex) {
	if (!sq || !sq.group || sq.groupNumber < 3) return false;
	for (var i = 0; i < sq.group.length; i++) {
		if (square[sq.group[i]].owner !== playerIndex) return false;
	}
	return true;
}

// Full-screen victory overlay. Replaces the bare popup that announced the winner.
// Triggered from game.eliminatePlayer when pcount drops to 1.
function __showVictory(winner) {
	if (!winner) return;
	var existing = document.getElementById('victory-overlay');
	if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

	// Game is over — fade the background music out.
	if (typeof Sound !== 'undefined' && Sound.stopMusic) Sound.stopMusic();

	// Record the win in global stats (persisted across sessions). Defensive
	// parsing: corrupted/tampered shapes get reset rather than crashing.
	try {
		var raw = window.localStorage.getItem('monopoly:stats') || '{}';
		var stats = JSON.parse(raw);
		if (!stats || typeof stats !== 'object') stats = {};
		if (typeof stats.games !== 'number') stats.games = 0;
		if (!stats.wins || typeof stats.wins !== 'object') stats.wins = {};
		stats.games += 1;
		stats.wins[winner.name] = (typeof stats.wins[winner.name] === 'number' ? stats.wins[winner.name] : 0) + 1;
		window.localStorage.setItem('monopoly:stats', JSON.stringify(stats));
	} catch (e) { /* localStorage unavailable: private mode */ }

	// Hide the live gameplay UI behind the overlay so the only clickable
	// elements are the overlay's own CTAs.
	UI.$hide("moneybar");

	var overlay = document.createElement('div');
	overlay.id = 'victory-overlay';

	var crown = document.createElement('div');
	crown.className = 'victory-crown';
	crown.textContent = '👑';
	overlay.appendChild(crown);

	var title = document.createElement('div');
	title.className = 'victory-title';
	title.textContent = (typeof t === 'function' ? t('ui.winnerLabel') : 'WINNER');
	overlay.appendChild(title);

	var name = document.createElement('div');
	name.className = 'victory-name';
	name.textContent = winner.name;
	name.style.color = '#fff';
	overlay.appendChild(name);

	var sub = document.createElement('div');
	sub.className = 'victory-sub';
	sub.textContent = (typeof t === 'function'
		? t('ui.victorySub', { player: winner.name })
		: winner.name + ' has bankrupted everyone else!');
	overlay.appendChild(sub);

	// Show the cumulative win count for this player.
	try {
		var stats2 = JSON.parse(window.localStorage.getItem('monopoly:stats') || '{}');
		if (!stats2 || typeof stats2 !== 'object') stats2 = {};
		var rawWins = (stats2.wins && typeof stats2.wins === 'object') ? stats2.wins[winner.name] : 1;
		var winCount = (typeof rawWins === 'number' && rawWins > 0) ? rawWins : 1;
		if (winCount > 1) {
			var careerEl = document.createElement('div');
			careerEl.className = 'victory-career';
			careerEl.textContent = (typeof tn === 'function'
				? tn('ui.careerWins', winCount)
				: winCount + ' total wins');
			overlay.appendChild(careerEl);
		}
	} catch (e) { /* localStorage unavailable: skip career line */ }

	// Primary CTA: Play Again (reloads the page — setup form keeps players).
	var btn = document.createElement('button');
	btn.className = 'victory-cta';
	btn.type = 'button';
	btn.textContent = (typeof t === 'function' ? t('ui.playAgain') : 'PLAY AGAIN');
	btn.addEventListener('click', function () {
		overlay.style.transition = 'opacity 280ms ease-out';
		overlay.style.opacity = '0';
		setTimeout(function () {
			if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
			if (typeof location !== 'undefined') location.reload();
		}, 320);
	});
	overlay.appendChild(btn);

	// Secondary CTA: View final stats. Dismisses the overlay temporarily,
	// shows the stats modal, and re-shows the overlay when stats close.
	var statsLink = document.createElement('button');
	statsLink.className = 'victory-stats-link';
	statsLink.type = 'button';
	statsLink.textContent = (typeof t === 'function' ? t('ui.viewStats') : 'View stats');
	statsLink.addEventListener('click', function () {
		overlay.style.transition = 'opacity 240ms ease-out';
		overlay.style.opacity = '0';
		setTimeout(function () {
			overlay.style.visibility = 'hidden';
			overlay.style.opacity = '';
			overlay.style.transition = '';
			// Function is showStats (camelCase). The earlier showstats() call
			// silently no-op'd because there's no such symbol.
			if (typeof showStats === 'function') showStats();
		}, 260);
	});
	overlay.appendChild(statsLink);

	// Remember the overlay so the stats-close handler can re-show it.
	window.GameState.victoryOverlay = overlay;

	document.body.appendChild(overlay);

	// Simple focus trap: Tab cycles between the two CTAs (Play Again, View Stats).
	// Without this, focus can drift to the (now-hidden) gameplay UI below.
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.tabIndex = -1;
	setTimeout(function () { if (btn && typeof btn.focus === 'function') btn.focus(); }, 260);
	overlay.addEventListener('keydown', function (e) {
		if (e.key !== 'Tab') return;
		var focusables = overlay.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])');
		if (!focusables.length) return;
		var first = focusables[0];
		var last = focusables[focusables.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault(); last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault(); first.focus();
		}
	});

	// Bigger, longer confetti drop to match the cinematic feel.
	__launchConfetti();
	setTimeout(__launchConfetti, 800);
	setTimeout(__launchConfetti, 1700);
}

// Graceful exit animation for an eliminated player. The token spins/fades and
// their money-bar row collapses. Called by eliminatePlayer BEFORE the DOM
// reshuffles, so we can grab the right elements first.
function __animateEliminate(playerSlot) {
	var tok = __tokens && __tokens[playerSlot];
	if (tok && tok.el) {
		tok.el.classList.remove('token-active');
		tok.el.classList.add('token-eliminating');
		var el = tok.el;
		setTimeout(function () {
			el.classList.remove('token-eliminating');
			if (el.parentNode) el.parentNode.removeChild(el);
			// Reset transient state so the slot can be reused next game.
			el.style.transform = '';
			el.style.transition = '';
			el.style.animation = '';
		}, 620);
	}
	var row = document.getElementById('moneybarrow' + playerSlot);
	if (row) {
		row.classList.add('moneybar-eliminating');
		setTimeout(function () { row.classList.remove('moneybar-eliminating'); }, 540);
	}
}

function __initTokenLayer() {
	if (__tokensInitialized) return;
	// Create 8 persistent token <div>s, one per possible player slot.
	// They start orphaned (no parent); updatePosition will adopt each one
	// into the right cell-position-holder.
	for (var i = 1; i <= 8; i++) {
		var t = document.createElement('div');
		t.id = 'token-' + i;
		t.className = 'token';
		t.style.display = 'none';
		__tokens[i] = { el: t };
	}
	__tokensInitialized = true;
}

// FLIP-style placement: re-parents `tok` into `hostEl` at (leftPx, topPx) and
// animates the visible position from where it was BEFORE the re-parent to
// where it is now. First placement (token not yet in DOM) uses a small
// scale-in keyframe; subsequent moves use a transform slide.
//
// Two subtleties:
//  - The token lives inside #game-stage which has `transform: scale(s)`.
//    Translation values on the token are interpreted in stage-local pixels,
//    so we divide the viewport-pixel delta from getBoundingClientRect by the
//    current stage scale to get the right travel distance.
//  - Setting transition='none', applying the inverted transform, and then
//    re-enabling transition + identity transform in the same synchronous
//    tick gets coalesced by the browser into a single computed-style update
//    (no animation). We wait one rAF between the two states so the browser
//    actually commits the inverted state before transitioning out of it.
function __placeTokenInCell(tok, hostEl, leftPx, topPx, cellKey, duration) {
	var inDom = !!tok.el.parentNode;
	var oldRect = inDom ? tok.el.getBoundingClientRect() : null;
	var cellChanged = tok.lastCellKey !== cellKey;
	tok.lastCellKey = cellKey;
	// Respect an explicit `duration` of 0 (used by __snapTokenToPosition to
	// instantly reposition a token after a teleport-style move). Falsy + null
	// + undefined still fall back to the default.
	var dur = (typeof duration === 'number') ? duration : 520;

	if (tok.el.parentNode !== hostEl) {
		hostEl.appendChild(tok.el);
	}
	tok.el.style.left = leftPx + 'px';
	tok.el.style.top  = topPx + 'px';

	if (!inDom) {
		// Use the dramatic "drop into GO" intro on game start, otherwise the
		// quick scale-pop for tokens that mount mid-game (rare; reload paths).
		if (tok.__pendingDrop) {
			tok.__pendingDrop = false;
			tok.el.classList.add('token-drop-in');
			setTimeout(function () { tok.el.classList.remove('token-drop-in'); }, 760);
		} else {
			tok.el.classList.add('token-arrive');
			setTimeout(function () { tok.el.classList.remove('token-arrive'); }, 280);
		}
		return;
	}

	var newRect = tok.el.getBoundingClientRect();
	var scale = (window.GameState.stageTx && window.GameState.stageTx.scale) || 1;
	var dx = (oldRect.left - newRect.left) / scale;
	var dy = (oldRect.top  - newRect.top)  / scale;
	if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

	tok.el.style.animation = 'none';
	tok.el.style.transition = 'none';
	tok.el.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
	// Force a synchronous layout commit so the inverted state is "real" to
	// the browser before we ask it to animate out of it.
	void tok.el.offsetWidth;

	// Hop class adds a drop-shadow keyframe in parallel with the slide so the
	// token feels like it lifts slightly off the board. Pure compositor work.
	tok.el.classList.remove('token-hop');
	void tok.el.offsetWidth;

	requestAnimationFrame(function () {
		tok.el.style.transition = 'transform ' + dur + 'ms cubic-bezier(.22, .9, .25, 1)';
		tok.el.style.transform = 'translate(0, 0)';
		if (cellChanged) tok.el.classList.add('token-hop');
		// Clear the inline transition after the animation so it doesn't
		// fight future updates that might piggyback on translateZ(0).
		setTimeout(function () {
			tok.el.style.transition = '';
			tok.el.style.transform = '';
			tok.el.classList.remove('token-hop');
		}, dur + 40);
	});

	if (cellChanged && typeof Sound !== 'undefined') Sound.move();
}

// Walk the active player's token forward `steps` cells, starting from cell
// `startPos`. Calls `done()` after the final step settles. This animates
// the visual journey only — the player's logical p.position should be set
// by the caller BEFORE invoking this (so other state stays consistent) or
// AFTER (so land() runs with the correct destination); see roll().
//
// ROBUSTNESS NOTES (why this is intentionally paranoid):
//   1. If a previous walk for the SAME token is still in-flight, its queued
//      setTimeout chain would keep firing and clobber positions on top of
//      this new walk. We track the pending timer per-token (`tok.__walkTimer`)
//      and cancel it before starting. We also tag each walk with a monotonic
//      run-id (`tok.__walkRunId`); every nested setTimeout checks its captured
//      runId matches the current one and bails out otherwise. Result: a stale
//      walk that beat clearTimeout can never side-effect a newer walk's token.
//   2. `window.GameState.walking` is the single source of truth used by `game.next()`
//      to refuse re-entry. We set it true synchronously here and only release
//      it when this walk's final done() fires — including in all early-exit
//      branches.
//   3. The final destination cell is `(startPos + steps) % 40`. The caller is
//      responsible for setting `p.position` to the SAME value before calling.
//      If they differ, we'd see "the token moved fewer/more steps than the
//      dice"; the guards below make sure no second walk can overwrite this.
function __walkPlayerSteps(playerSlot, startPos, steps, done) {
	var tok = __tokens && __tokens[playerSlot];
	function safeDone() {
		// Sprint 2 (S2.1) — token squash/squish on final-step landing. The
		// keyframe is defined in styles.css (.tok-land → @keyframes tok-squash).
		// One-shot via animationend; the listener removes the class so a
		// follow-up walk can re-trigger the animation. We DO NOT cancel the
		// existing `.token-land` class added during the final step — they
		// stack: token-land plays its compositor-only stretch first, then
		// tok-land overlays the requested 320ms squash curve.
		try {
			if (tok && tok.el && tok.el.classList) {
				var el = tok.el;
				el.classList.remove('tok-land');
				// Force reflow so re-adding the class restarts the animation.
				void el.offsetWidth;
				el.classList.add('tok-land');
				var onEnd = function (ev) {
					if (ev && ev.animationName && ev.animationName !== 'tok-squash') return;
					el.classList.remove('tok-land');
					el.removeEventListener('animationend', onEnd);
				};
				el.addEventListener('animationend', onEnd);
			}
		} catch (e) {}
		window.GameState.walking = false;
		if (done) { var d = done; done = null; d(); }
	}
	if (!tok || !steps || steps <= 0) { window.GameState.walking = false; if (done) done(); return; }
	if (!tok.el.parentNode) { window.GameState.walking = false; if (done) done(); return; }

	// Cancel any prior walk on this token. Both the timer and the run-id
	// guard together stop the previous chain from firing further steps.
	if (tok.__walkTimer) { clearTimeout(tok.__walkTimer); tok.__walkTimer = null; }
	tok.__walkRunId = (tok.__walkRunId || 0) + 1;
	var myRunId = tok.__walkRunId;

	window.GameState.walking = true;

	var STEP_MS = 180;        // time the cube needs to feel like a hop
	var TRANSITION_MS = 150;  // slightly less so the next step can chain

	function isStale() { return tok.__walkRunId !== myRunId; }

	// SNAP to startPos before the first step. Without this, if the token's
	// last cellKey doesn't match startPos (because a previous teleport-style
	// move set p.position but skipped the visual snap, or a stale timer
	// nudged the token elsewhere), the first step would animate from the
	// wrong origin and the player would see the token "jump" or appear to
	// traverse the wrong number of cells. The snap is a no-op when the
	// token is already at startPos (transitionMs=0 + identical key).
	var snapHost = document.getElementById('cell' + startPos + 'positionholder');
	var snapCell = document.getElementById('cell' + startPos);
	if (snapHost && snapCell) {
		var sX = 6, sY = 6;
		if      (snapCell.classList.contains('board-bottom')) { sY = 28; }
		else if (snapCell.classList.contains('board-top'))    { sY = 6;  }
		else if (snapCell.classList.contains('board-left'))   { sX = 6;  }
		else if (snapCell.classList.contains('board-right'))  { sX = 28; }
		else if (snapCell.classList.contains('board-corner')) { sX = 8; sY = 8; }
		var expectedKey = 'cell' + startPos;
		if (tok.lastCellKey !== expectedKey) {
			__placeTokenInCell(tok, snapHost, sX, sY, expectedKey, 0);
		}
	}

	function step(i) {
		if (isStale()) return; // another walk superseded us
		var cellIdx = (startPos + i) % 40;
		var hostEl = document.getElementById('cell' + cellIdx + 'positionholder');
		var cellEl = document.getElementById('cell' + cellIdx);
		if (!hostEl || !cellEl) {
			if (i < steps) tok.__walkTimer = setTimeout(function () { step(i + 1); }, STEP_MS);
			else {
				// Final-step DOM missing: snap token to the logical destination
				// so the visual never lags p.position when the cell vanished.
				try { __snapTokenToPosition(playerSlot); } catch (e) {}
				safeDone();
			}
			return;
		}
		var insetX = 6, insetY = 6;
		if (cellEl.classList.contains('board-bottom'))      { insetY = 28; }
		else if (cellEl.classList.contains('board-top'))    { insetY = 6;  }
		else if (cellEl.classList.contains('board-left'))   { insetX = 6;  }
		else if (cellEl.classList.contains('board-right'))  { insetX = 28; }
		else if (cellEl.classList.contains('board-corner')) { insetX = 8; insetY = 8; }

		__placeTokenInCell(tok, hostEl, insetX, insetY, 'cell' + cellIdx, TRANSITION_MS);

		if (i >= steps) {
			tok.el.classList.remove('token-land');
			void tok.el.offsetWidth;
			tok.el.classList.add('token-land');
			setTimeout(function () { tok.el.classList.remove('token-land'); }, 400);
			cellEl.classList.remove('cell-landed-flash');
			void cellEl.offsetWidth;
			cellEl.classList.add('cell-landed-flash');
			setTimeout(function () { cellEl.classList.remove('cell-landed-flash'); }, 600);
			if (typeof Sound !== 'undefined' && Sound.diceLand) {
				setTimeout(function () { if (!isStale()) Sound.diceLand(); }, TRANSITION_MS - 40);
			}
			tok.__walkTimer = setTimeout(function () {
				if (isStale()) return;
				tok.__walkTimer = null;
				safeDone();
			}, STEP_MS);
			return;
		}
		tok.__walkTimer = setTimeout(function () { step(i + 1); }, STEP_MS);
	}
	step(1);
}

// Snap a token to its current p.position without animation. Used after
// "teleport" moves (advance(), gobackthreespaces, gotojail, jail-exit) so
// the visual position never drifts from the logical one between turns.
// Idempotent and silent — no walk timers, no done callbacks.
function __snapTokenToPosition(playerSlot) {
	var tok = __tokens && __tokens[playerSlot];
	if (!tok || !tok.el || !tok.el.parentNode) return;
	if (typeof player === 'undefined' || !player[playerSlot]) return;
	var idx = player[playerSlot].position;
	if (typeof idx !== 'number' || idx < 0 || idx >= 40) return;
	var hostEl = document.getElementById('cell' + idx + 'positionholder');
	var cellEl = document.getElementById('cell' + idx);
	if (!hostEl || !cellEl) return;
	var insetX = 6, insetY = 6;
	if (cellEl.classList.contains('board-bottom'))      { insetY = 28; }
	else if (cellEl.classList.contains('board-top'))    { insetY = 6;  }
	else if (cellEl.classList.contains('board-left'))   { insetX = 6;  }
	else if (cellEl.classList.contains('board-right'))  { insetX = 28; }
	else if (cellEl.classList.contains('board-corner')) { insetX = 8; insetY = 8; }
	// transitionMs = 0 → no animation; the token snaps to the new cell.
	__placeTokenInCell(tok, hostEl, insetX, insetY, 'cell' + idx, 0);
}

function updatePosition() {
	// Reset previous-frame cell highlight. Optimization: only clear the
	// single cell we highlighted last turn instead of iterating all 40.
	// Saves 39 inline-border writes (each a layout-triggering operation)
	// per call — and updatePosition runs often (every walk step + many
	// game-engine actions).
	if (window.GameState.lastHighlightedCellId) {
		var prevEl = document.getElementById(window.GameState.lastHighlightedCellId);
		if (prevEl) prevEl.style.border = '';
	}
	window.GameState.lastHighlightedCellId = null;

	if (!__tokensInitialized) return;

	// Iteration order: current turn first so they sit at slot 0 of the stack,
	// then wrap around. Matches the original visual.
	var iterOrder = [];
	for (var y = turn; y <= pcount; y++) iterOrder.push(y);
	for (var y = 1; y < turn; y++) iterOrder.push(y);

	// Pre-pass: count how many tokens land in each cell. We use this to
	// pick a stacking step (tight when crowded, loose when empty) so 7-8
	// players on one cell don't spill outside the cell bounds.
	var cellCounts = {};
	for (var pp = 1; pp <= pcount; pp++) {
		var pl = player[pp];
		if (!pl) continue;
		var key = pl.jail ? 'jail' : ('cell' + pl.position);
		cellCounts[key] = (cellCounts[key] || 0) + 1;
	}

	// Per-cell stacking slot. Step chosen per-cell based on density:
	//   1-3 tokens → 18px (comfortable)
	//   4-5       → 12px (tight)
	//   6-8       → 9px  (compact / overlapping)
	var slots = {};                              // cellIndex -> { left, top, step, cols }
	var jailSlot = { left: 0, top: 0, step: 14, cols: 3 };

	function __stepForCount(n) {
		if (n <= 3) return { step: 18, cols: 3 };
		if (n <= 5) return { step: 12, cols: 3 };
		return { step: 9, cols: 4 };
	}

	for (var k = 0; k < iterOrder.length; k++) {
		var pIdx = iterOrder[k];
		var p = player[pIdx];
		var tok = __tokens[pIdx];
		if (!tok) continue;
		if (pIdx > pcount || !p) {
			tok.el.style.display = 'none';
			if (tok.el.parentNode) tok.el.parentNode.removeChild(tok.el);
			continue;
		}

		tok.el.style.backgroundColor = p.color;
		// Rich tooltip via data-attr so CSS can render a styled bubble
		// (vs. the ugly native browser tooltip).
		tok.el.removeAttribute('title');
		tok.el.setAttribute('data-tok-tip', p.name + ' · $' + p.money);
		tok.el.style.display = 'flex';
		// Render the player's chosen avatar (PNG) inside the colored disc.
		// p.avatar holds an option id ("sombrero", "automovil", …); resolve to
		// a file path through the AVATAR_OPTIONS lookup.
		var avFile = '';
		if (p.avatar && window.GameConfig.avatarOptions) {
			for (var ax = 0; ax < window.GameConfig.avatarOptions.length; ax++) {
				if (window.GameConfig.avatarOptions[ax].id === p.avatar) {
					avFile = window.GameConfig.avatarOptions[ax].file;
					break;
				}
			}
		}
		if (avFile) {
			if (tok.el.dataset.avatarFile !== avFile) {
				tok.el.style.backgroundImage = "url('" + avFile + "')";
				tok.el.dataset.avatarFile = avFile;
				tok.el.textContent = '';
			}
		} else {
			tok.el.style.backgroundImage = '';
			delete tok.el.dataset.avatarFile;
		}

		// Pick the right host element + per-side inset.
		var hostEl, insetX = 6, insetY = 6;
		if (p.jail) {
			hostEl = document.getElementById('jailpositionholder') || document.getElementById('jail');
			insetX = 4; insetY = 4;
		} else {
			hostEl = document.getElementById('cell' + p.position + 'positionholder');
			var cellEl = document.getElementById('cell' + p.position);
			if (cellEl.classList.contains('board-bottom'))      { insetY = 28; }
			else if (cellEl.classList.contains('board-top'))    { insetY = 6;  }
			else if (cellEl.classList.contains('board-left'))   { insetX = 6;  }
			else if (cellEl.classList.contains('board-right'))  { insetX = 28; }
			else if (cellEl.classList.contains('board-corner')) { insetX = 8; insetY = 8; }
		}

		// Compute stacking slot for this cell/jail with density-aware step.
		var slot;
		if (p.jail) {
			slot = jailSlot;
		} else {
			if (!slots[p.position]) {
				var stepInfo = __stepForCount(cellCounts['cell' + p.position] || 1);
				slots[p.position] = { left: 0, top: 0, step: stepInfo.step, cols: stepInfo.cols };
			}
			slot = slots[p.position];
		}

		var cellKey = p.jail ? 'jail' : ('cell' + p.position);
		__placeTokenInCell(tok, hostEl, insetX + slot.left, insetY + slot.top, cellKey);

		// Halo on the turn player's token only; clear from the others.
		if (pIdx === turn) {
			tok.el.classList.add('token-active');
			// Expose the player color so the spotlight ring matches.
			tok.el.style.setProperty('--token-ring', p.color);
		} else {
			tok.el.classList.remove('token-active');
		}

		// Advance to next slot using this cell's specific step/cols.
		var maxLeft = (slot.cols - 1) * slot.step;
		if (slot.left >= maxLeft) { slot.left = 0; slot.top += slot.step; }
		else                       { slot.left += slot.step; }
	}

	// Hide / remove tokens for player slots not in use this game (pcount < 8).
	for (var i = pcount + 1; i <= 8; i++) {
		if (__tokens[i]) {
			__tokens[i].el.style.display = 'none';
			if (__tokens[i].el.parentNode) __tokens[i].el.parentNode.removeChild(__tokens[i].el);
		}
	}

	// Highlight current player's cell border.
	// Also (intentionally) assign to the implicit global `p` — the original
	// updatePosition leaked it and several callers downstream depend on it
	// being the turn player. Keeping the side-effect avoids cascading bugs.
	p = player[turn];
	var highlightId;
	if (p.jail) {
		highlightId = 'jail';
	} else {
		highlightId = 'cell' + p.position;
	}
	var highlightEl = document.getElementById(highlightId);
	if (highlightEl) {
		highlightEl.style.border = '1px solid ' + p.color;
		window.GameState.lastHighlightedCellId = highlightId;
	}
}

// Previous-frame snapshot of each player's money so updateMoney() can detect
// deltas and pulse the affected cell. Initialized empty; first call seeds it
// without animating (avoids a spurious pulse at game start).
var __prevMoney = {};

// Sprint 1 (S1.4) — best-effort haptic feedback for touch devices. Silent
// no-op on desktop / iOS Safari (no navigator.vibrate). Pattern follows the
// Vibration API shape: number or array of on/off durations in ms.
function __haptic(pattern) {
	if (navigator && typeof navigator.vibrate === 'function') {
		try { navigator.vibrate(pattern); } catch (e) { /* swallow */ }
	}
}
// Expose on window so cross-file callers (ai.js) can reach it without
// scope shenanigans.
if (typeof window !== 'undefined') { window.__haptic = __haptic; }

// Sprint 2 (S2.2) — screen shake on key events.
// Drives the CSS custom properties --shake-x / --shake-y on #game-stage,
// which fitStage() composes into the master `transform` string via the
// --stage-transform property. We DO NOT touch stage.style.transform here:
// fitStage() owns the base translate/rotate/scale, and overriding it would
// break the responsive fit. Decay is linear over the requested duration.
//
// Respects prefers-reduced-motion: returns immediately if the user opts out.
// Re-entrant: if a second shake fires before the first finishes, the new
// one cancels the old (no double-amplitude artifacts).
function __shake(magnitude, durationMs) {
	try {
		if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
	} catch (e) {}
	var stage = document.getElementById('game-stage');
	if (!stage) return;
	magnitude = +magnitude || 0;
	durationMs = +durationMs || 300;
	if (magnitude <= 0 || durationMs <= 0) return;

	// Cancel any in-flight shake — last-one-wins semantics.
	if (window.__shakeRaf) {
		cancelAnimationFrame(window.__shakeRaf);
		window.__shakeRaf = 0;
	}
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	function tick(now) {
		var t = (now - start) / durationMs;
		if (t >= 1) {
			stage.style.setProperty('--shake-x', '0px');
			stage.style.setProperty('--shake-y', '0px');
			window.__shakeRaf = 0;
			return;
		}
		var amp = magnitude * (1 - t); // linear decay
		var dx = (Math.random() * 2 - 1) * amp;
		var dy = (Math.random() * 2 - 1) * amp;
		stage.style.setProperty('--shake-x', dx.toFixed(2) + 'px');
		stage.style.setProperty('--shake-y', dy.toFixed(2) + 'px');
		window.__shakeRaf = requestAnimationFrame(tick);
	}
	window.__shakeRaf = requestAnimationFrame(tick);
}
if (typeof window !== 'undefined') { window.__shake = __shake; }

// Sprint 2 (S2.3) — camera zoom pulse on celebratory rolls / fat rents.
// Drives --zoom-scale on #game-stage; the stage's `transform` rule multiplies
// the base scale by --zoom-scale, so the pulse composes cleanly with
// fitStage()'s base transform and the shake offsets. Easing is done in JS
// (rAF lerp) because CSS transitions on `transform` would fight the
// per-frame shake helper.
//
// Curve: 0 → 1 over the first 40 % (ease-out), then 1 → 0 over the
// remaining 60 % (ease-in). Magnitude `scale` is the peak deviation above 1
// (e.g. 1.04 = a 4 % zoom-in).
function __zoomPulse(scale, ms) {
	try {
		if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
	} catch (e) {}
	var stage = document.getElementById('game-stage');
	if (!stage) return;
	scale = +scale || 1;
	ms = +ms || 600;
	if (scale === 1 || ms <= 0) return;
	if (window.__zoomRaf) {
		cancelAnimationFrame(window.__zoomRaf);
		window.__zoomRaf = 0;
	}
	var peak = scale - 1;
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	stage.classList.add('is-zooming');
	function tick(now) {
		var t = (now - start) / ms;
		if (t >= 1) {
			stage.style.setProperty('--zoom-scale', '1');
			stage.classList.remove('is-zooming');
			window.__zoomRaf = 0;
			return;
		}
		// 0..0.4 ramp up (ease-out), 0.4..1 ramp down (ease-in)
		var amp;
		if (t < 0.4) {
			var u = t / 0.4;
			amp = 1 - (1 - u) * (1 - u); // ease-out quadratic
		} else {
			var v = (t - 0.4) / 0.6;
			amp = 1 - v * v;             // ease-in quadratic (mirrored)
		}
		stage.style.setProperty('--zoom-scale', String(1 + peak * amp));
		window.__zoomRaf = requestAnimationFrame(tick);
	}
	window.__zoomRaf = requestAnimationFrame(tick);
}
if (typeof window !== 'undefined') { window.__zoomPulse = __zoomPulse; }

// Sprint 1 (S1.1) — rolling-counter animation for the active player's cash.
// Tweens fromVal → toVal over durationMs (default 600/400 depending on sign)
// using easeOutCubic and rAF. Renders with "$ " prefix. Cancels any prior
// animation on the same element via el.__numAnimId so rapid pay() / collect()
// sequences don't fight each other. opts.flash adds a brief color flash.
