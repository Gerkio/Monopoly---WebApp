// =====================================================================
// engine.js — Sprint 5 split-out from monopoly.js.
// Contains: the GameState/GameConfig namespace bootstrap IIFE, plus
// the Game() constructor (dice, auction, trade, bankruptcy, turn
// dispatch). All symbols remain top-level globals so the other split
// modules (players.js, animations.js, render.js, monopoly.js boot)
// can keep calling them by bare name as they always did.
// =====================================================================

// =====================================================================
// Global state bootstrap. Collapses the historically-scattered window.__*
// flags into two namespaces, with backward-compat shims so legacy reads
// (and any AI / edition code we haven't migrated yet) keep working while
// the migration is incremental.
//
//   window.GameState  — mutable runtime: walking, pendingBuyDecision,
//                       stageTx, freeParkingPot, popupAutoTimer, etc.
//   window.GameConfig — data/rules:      houseRules, avatarOptions,
//                       edition, theme, startingCash, autoRollMs.
//
// New code should write directly to GameState / GameConfig. The
// Object.defineProperty shim warns ONCE per old key on the first set
// from legacy code paths, so the console points at any unmigrated call
// site. Functions exposed on window.__* (e.g. __openHelp, __startTour,
// __previewBuyConsequence) are NOT state and are intentionally out of
// scope for this migration.
// =====================================================================
(function () {
	window.GameState  = window.GameState  || {};
	window.GameConfig = window.GameConfig || {};

	// Initialize defensively-read values so the "(obj && obj.field) || fallback"
	// pattern downstream sees the expected shape from turn 0.
	window.GameState.stageTx             = { scale: 1, rotation: 0, cos: 1, sin: 0 };
	window.GameState.freeParkingPot      = 0;
	window.GameState.walking             = false;
	window.GameState.pendingBuyDecision  = false;
	window.GameState.skipNextUpdateDice  = false;

	var MIGRATE = {
		__walking:              { ns: 'state',  key: 'walking' },
		__pendingBuyDecision:   { ns: 'state',  key: 'pendingBuyDecision' },
		__popupAutoTimer:       { ns: 'state',  key: 'popupAutoTimer' },
		__freeParkingPot:       { ns: 'state',  key: 'freeParkingPot' },
		__lastHighlightedCellId:{ ns: 'state',  key: 'lastHighlightedCellId' },
		__skipNextUpdateDice:   { ns: 'state',  key: 'skipNextUpdateDice' },
		__STAGE_TX:             { ns: 'state',  key: 'stageTx' },
		__victoryOverlay:       { ns: 'state',  key: 'victoryOverlay' },
		__tokens:               { ns: 'state',  key: 'tokens' },
		__HOUSE_RULES:          { ns: 'config', key: 'houseRules' },
		__AVATAR_OPTIONS:       { ns: 'config', key: 'avatarOptions' },
		__EDITION:              { ns: 'config', key: 'edition' },
		__THEME:                { ns: 'config', key: 'theme' },
		__startingCash:         { ns: 'config', key: 'startingCash' },
		__AUTO_ROLL_MS:         { ns: 'config', key: 'autoRollMs' },
		__AI_ADAPTIVE_DEBUG:    { ns: 'config', key: 'aiAdaptiveDebug' }
	};

	var warned = {};
	for (var oldKey in MIGRATE) {
		if (!MIGRATE.hasOwnProperty(oldKey)) continue;
		(function (k) {
			var info = MIGRATE[k];
			var bag  = info.ns === 'state' ? window.GameState : window.GameConfig;
			try {
				Object.defineProperty(window, k, {
					configurable: true,
					get: function () { return bag[info.key]; },
					set: function (v) {
						if (!warned[k]) {
							warned[k] = true;
							if (window.console && console.warn) {
								console.warn('[Monopoly] window.' + k + ' is deprecated; use ' +
									(info.ns === 'state' ? 'GameState.' : 'GameConfig.') + info.key);
							}
						}
						bag[info.key] = v;
					}
				});
			} catch (e) { /* defineProperty unsupported on this property */ }
		})(oldKey);
	}
})();

function Game() {
	var die1;
	var die2;
	var areDiceRolled = false;

	var auctionQueue = [];
	var highestbidder;
	var highestbid;
	var currentbidder = 1;
	var auctionproperty;

	this.rollDice = function() {
		die1 = Math.floor(Math.random() * 6) + 1;
		die2 = Math.floor(Math.random() * 6) + 1;
		areDiceRolled = true;
	};

	this.resetDice = function() {
		areDiceRolled = false;
	};

	this.next = function() {
		// Ignore re-entries while a token is mid-walk. Without this, a humano
		// impatient enough to mash Space mid-animation can fire roll() before
		// the previous turn's land() resolves, corrupting p.position.
		if (window.__walking) return;
		if (window.__pendingBuyDecision) return;
		// `p` used to leak in as an implicit global from updatePosition's
		// `p = player[turn]` (no var). When updatePosition was rewritten with
		// local-only state for the new token layer, the leak disappeared and
		// this branch crashed. Declare it locally — works regardless.
		var p = player[turn];
		if (!p.human && p.money < 0) {
			p.AI.payDebt();

			if (p.money < 0) {
				popup("<p>" + t('popup.bankrupt', { player: p.name, creditor: player[p.creditor].name }) + "</p>", game.bankruptcy);
			} else {
				roll();
			}
		} else if (areDiceRolled && doublecount === 0) {
			play();
		} else {
			roll();
		}
	};

	this.getDie = function(die) {
		if (die === 1) {

			return die1;
		} else {

			return die2;
		}

	};



	// Auction functions:



	var finalizeAuction = function() {
		var p = player[highestbidder];
		var sq = square[auctionproperty];

		if (highestbid > 0) {
			p.pay(highestbid, 0);
			sq.owner = highestbidder;
			addAlert(t('alert.boughtProperty', { player: p.name, place: sq.name, price: highestbid }));
			if (typeof UI !== 'undefined') UI.toast(t('alert.boughtProperty', { player: p.name, place: sq.name, price: highestbid }), { kind: 'success' });
			if (typeof Sound !== 'undefined') Sound.coin();
			if (typeof __pulsePurchasedCell === 'function') __pulsePurchasedCell(auctionproperty, p.color);
		}

		for (var i = 1; i <= pcount; i++) {
			player[i].bidding = true;
		}

		$("#popupbackground").hide();
		$("#popupwrap").hide();
		window.__pendingBuyDecision = false;

		if (!game.auction()) {
			play();
		}
	};

	this.addPropertyToAuctionQueue = function(propertyIndex) {
		auctionQueue.push(propertyIndex);
	};

	this.auction = function() {
			if (auctionQueue.length === 0) {
				return false;
			}

			// Drain invalid entries iteratively to avoid deep recursion on
			// long-running games where many queued properties become stale.
			var index = null;
			var s = null;
			while (auctionQueue.length > 0) {
				index = auctionQueue.shift();
				s = square[index];
				if (s && s.price !== 0 && s.owner === 0) break;
				index = null;
				s = null;
			}
			if (!s) return false;

		auctionproperty = index;
		highestbidder = 0;
		highestbid = 0;
		currentbidder = turn + 1;

		if (currentbidder > pcount) {
			currentbidder -= pcount;
		}

		// Build the redesigned auction popup. The structure breaks into four
		// labelled rows so a tabletop full of players can scan it: title,
		// highest-bid headline, full bidder list (live status per player),
		// then the input + action buttons. The popup is sized larger by the
		// .auction-popup class so the property name and bidder roster have
		// breathing room.
		var swatchColor = (s.color && s.color !== '#FFFFFF' && s.color !== 'white') ? s.color : 'var(--gold)';
		var auctionHTML =
			"<div class='auction-modal'>" +
				"<div class='auction-title-row'>" +
					"<span class='auction-color-swatch' style='background:" + swatchColor + "'></span>" +
					"<div class='auction-title-block'>" +
						"<div class='auction-title-label'>" + I18N.escape(t('auction.title')) + "</div>" +
						"<div class='auction-property-name' id='propertyname'></div>" +
						"<div class='auction-property-price'>" + I18N.escape(t('deed.price')) + " $" + s.price + "</div>" +
					"</div>" +
				"</div>" +
				"<div class='auction-highest-row'>" +
					"<div class='auction-stat'>" +
						"<div class='auction-stat-label'>" + I18N.escape(t('auction.highestBid')) + "</div>" +
						"<div class='auction-stat-value'>$<span id='highestbid'>0</span></div>" +
						"<div class='auction-stat-sub'><span id='highestbidder'>" + I18N.escape(t('auction.na')) + "</span></div>" +
					"</div>" +
					"<div class='auction-stat'>" +
						"<div class='auction-stat-label'>" + I18N.escape(t('auction.yourTurnLabel') || 'Turno de') + "</div>" +
						"<div class='auction-stat-value auction-current-name' id='currentbidder'></div>" +
						"<div class='auction-stat-sub'>" + I18N.escape(t('auction.cashLabel') || 'Disponible') + ": $<span id='auctionCurrentCash'>0</span></div>" +
					"</div>" +
				"</div>" +
				"<div class='auction-bidders-row' id='auctionBidders'></div>" +
				"<div class='auction-input-row'>" +
					"<input id='bid' type='text' inputmode='numeric' placeholder='" + I18N.escape(t('auction.bidPlaceholder', { place: s.name })) + "' title='" + I18N.escape(t('auction.bidPlaceholder', { place: s.name })) + "' />" +
				"</div>" +
				"<div class='auction-buttons-row'>" +
					"<input type='button' class='auction-btn-bid'  value='" + I18N.escape(t('ui.bid')) + "' onclick='game.auctionBid();' title='" + I18N.escape(t('ui.bidTitle')) + "' />" +
					"<input type='button' class='auction-btn-pass' value='" + I18N.escape(t('ui.pass')) + "' title='" + I18N.escape(t('ui.passTitle')) + "' onclick='game.auctionPass();' />" +
					"<input type='button' class='auction-btn-exit' value='" + I18N.escape(t('ui.exitAuction')) + "' title='" + I18N.escape(t('ui.exitAuctionTitle', { place: s.name })) + "' onclick='__confirmAuctionExit();' />" +
				"</div>" +
			"</div>";
		popup(auctionHTML, "blank");
		document.getElementById('popup').classList.add('auction-popup');

		document.getElementById("propertyname").textContent = s.name;
		document.getElementById("highestbid").textContent = "0";
		document.getElementById("highestbidder").textContent = t('auction.na');
		document.getElementById("currentbidder").textContent = player[currentbidder].name;
		document.getElementById("currentbidder").style.color = player[currentbidder].color;
		document.getElementById("auctionCurrentCash").textContent = player[currentbidder].money;
		__renderAuctionBidders();
		document.getElementById("bid").onkeydown = function (e) {
			var key = e.keyCode;
			var isCtrl = e.ctrlKey;
			var isShift = e.shiftKey;

			if (isNaN(key)) {
				return true;
			}

			if (key === 13) {
				game.auctionBid();
				return false;
			}

			// Allow backspace, tab, delete, arrow keys, or if control was pressed, respectively.
			if (key === 8 || key === 9 || key === 46 || (key >= 35 && key <= 40) || isCtrl) {
				return true;
			}

			if (isShift) {
				return false;
			}

			// Only allow number keys.
			return (key >= 48 && key <= 57) || (key >= 96 && key <= 105);
		};

		document.getElementById("bid").onfocus = function () {
			this.style.color = "";
			if (isNaN(this.value)) {
				this.value = "";
			}
			var amt = parseInt(this.value, 10) || 0;
			if (typeof __showConsequencePreview === 'function') {
				__showConsequencePreview(this, player[currentbidder].money, -amt, 200);
			}
		};
		// Live consequence preview as the bidder types.
		document.getElementById("bid").oninput = function () {
			var amt = parseInt(this.value, 10) || 0;
			if (typeof __showConsequencePreview === 'function') {
				__showConsequencePreview(this, player[currentbidder].money, -amt, 200);
			}
		};
		document.getElementById("bid").onblur = function () {
			if (typeof __hideConsequencePreview === 'function') __hideConsequencePreview();
		};

		updateMoney();

		if (!player[currentbidder].human) {
			currentbidder = turn; // auctionPass advances currentbidder.
			this.auctionPass();
		}
		return true;
	};

	this.auctionPass = function() {
		if (highestbidder === 0) {
			highestbidder = currentbidder;
		}

		while (true) {
			currentbidder++;

			if (currentbidder > pcount) {
				currentbidder -= pcount;
			}

			if (currentbidder == highestbidder) {
				finalizeAuction();
				return;
			} else if (player[currentbidder].bidding) {
				var p = player[currentbidder];

				if (!p.human) {
					var bid = p.AI.bid(auctionproperty, highestbid);

					if (bid === -1 || highestbid >= p.money) {
						p.bidding = false;

						__auctionAnnounce(t('alert.exitedAuction', { player: p.name }), 'warning');
						__renderAuctionBidders();
						continue;

					} else if (bid === 0) {
						__auctionAnnounce(t('alert.passedAuction', { player: p.name }), 'info');
						__renderAuctionBidders();
						continue;

					} else if (bid > 0) {
						this.auctionBid(bid);
						__auctionAnnounce(t('alert.bidAmount', { player: p.name, amount: bid }), 'success');
						__renderAuctionBidders();
						continue;
					}
					return;
				} else {
					break;
				}
			}

		}

		var cb = document.getElementById("currentbidder");
		if (cb) {
			cb.textContent = player[currentbidder].name;
			cb.style.color = player[currentbidder].color;
		}
		var cash = document.getElementById("auctionCurrentCash");
		if (cash) cash.textContent = player[currentbidder].money;
		document.getElementById("bid").value = "";
		document.getElementById("bid").style.color = "";
		document.getElementById("bid").focus();
		__renderAuctionBidders();
	};

	this.auctionBid = function(bid) {
		bid = bid || parseInt(document.getElementById("bid").value, 10);

		if (bid === "" || bid === null) {
			document.getElementById("bid").value = t('auction.enterBid');
			document.getElementById("bid").style.color = "red";
		} else if (isNaN(bid)) {
			document.getElementById("bid").value = t('auction.bidNumeric');
			document.getElementById("bid").style.color = "red";
		} else {

			if (bid > player[currentbidder].money) {
				document.getElementById("bid").value = t('auction.bidNotEnough', { bid: bid });
				document.getElementById("bid").style.color = "red";
			} else if (bid > highestbid) {
				highestbid = bid;
				document.getElementById("highestbid").innerHTML = parseInt(bid, 10);
				highestbidder = currentbidder;
				document.getElementById("highestbidder").textContent = player[highestbidder].name;

				document.getElementById("bid").focus();

				if (player[currentbidder].human) {
					this.auctionPass();
				}
			} else {
				document.getElementById("bid").value = "Your bid must be greater than highest bid. ($" + highestbid + ")";
				document.getElementById("bid").style.color = "red";
			}
		}
	};

	this.auctionExit = function() {
		player[currentbidder].bidding = false;
		this.auctionPass();
	};



	// Trade functions:



	var currentInitiator;
	var currentRecipient;

	// Define event handlers:

	var tradeMoneyOnKeyDown = function (e) {
		var key = e.keyCode;
		var isCtrl = e.ctrlKey;
		var isShift = e.shiftKey;

		if (isNaN(key)) {
			return true;
		}

		if (key === 13) {
			return false;
		}

		// Allow backspace, tab, delete, arrow keys, or if control was pressed, respectively.
		if (key === 8 || key === 9 || key === 46 || (key >= 35 && key <= 40) || isCtrl) {
			return true;
		}

		if (isShift) {
			return false;
		}

		// Only allow number keys.
		return (key >= 48 && key <= 57) || (key >= 96 && key <= 105);
	};

	var tradeMoneyOnFocus = function () {
		this.style.color = "black";
		if (isNaN(this.value) || this.value === "0") {
			this.value = "";
		}
	};

	var tradeMoneyOnChange = function(e) {
		$("#proposetradebutton").show();
		$("#canceltradebutton").show();
		$("#accepttradebutton").hide();
		$("#rejecttradebutton").hide();

		var amount = this.value;

		if (isNaN(amount)) {
			this.value = "This value must be a number.";
			this.style.color = "red";
			return false;
		}

		amount = Math.round(amount) || 0;
		this.value = amount;

		if (amount < 0) {
			this.value = "This value must be greater than 0.";
			this.style.color = "red";
			return false;
		}

		return true;
	};

	document.getElementById("trade-leftp-money").onkeydown = tradeMoneyOnKeyDown;
	document.getElementById("trade-rightp-money").onkeydown = tradeMoneyOnKeyDown;
	document.getElementById("trade-leftp-money").onfocus = tradeMoneyOnFocus;
	document.getElementById("trade-rightp-money").onfocus = tradeMoneyOnFocus;
	document.getElementById("trade-leftp-money").onchange = tradeMoneyOnChange;
	document.getElementById("trade-rightp-money").onchange = tradeMoneyOnChange;

	// Live trade summary: shows the cash + property delta from the recipient's
	// perspective so a human can sanity-check before clicking Propose / Accept.
	function __updateTradeSummary() {
		var sumEl = document.getElementById('trade-summary');
		if (!sumEl) return;
		if (!currentInitiator || !currentRecipient) {
			sumEl.className = 'trade-summary is-empty';
			sumEl.textContent = t('trade.summaryEmpty');
			return;
		}
		var leftMoney  = parseInt(document.getElementById('trade-leftp-money').value, 10) || 0;
		var rightMoney = parseInt(document.getElementById('trade-rightp-money').value, 10) || 0;
		var givesNames = [], getsNames = [];
		for (var i = 0; i < 40; i++) {
			var cbL = document.getElementById('tradeleftcheckbox' + i);
			var cbR = document.getElementById('traderightcheckbox' + i);
			if (cbL && cbL.checked) givesNames.push(square[i].name);
			if (cbR && cbR.checked) getsNames.push(square[i].name);
		}
		// Jail cards (indexes 40, 41).
		var jailCardName = t('stats.gojfCard');
		[40, 41].forEach(function (idx) {
			var cbL = document.getElementById('tradeleftcheckbox'  + idx);
			var cbR = document.getElementById('traderightcheckbox' + idx);
			if (cbL && cbL.checked) givesNames.push(jailCardName);
			if (cbR && cbR.checked) getsNames.push(jailCardName);
		});
		if (givesNames.length === 0 && getsNames.length === 0 && !leftMoney && !rightMoney) {
			sumEl.className = 'trade-summary is-empty';
			sumEl.textContent = t('trade.summaryEmpty');
			return;
		}
		var netCash = rightMoney - leftMoney;
		var givesLine = t('trade.summaryGive') + ' ' +
			(leftMoney > 0 ? ('$' + leftMoney) : '') +
			(leftMoney > 0 && givesNames.length ? ' + ' : '') +
			givesNames.join(', ');
		var getsLine = t('trade.summaryGet') + ' ' +
			(rightMoney > 0 ? ('$' + rightMoney) : '') +
			(rightMoney > 0 && getsNames.length ? ' + ' : '') +
			getsNames.join(', ');
		var netCls = netCash > 0 ? 'trade-summary-net-positive'
		           : netCash < 0 ? 'trade-summary-net-negative'
		           : '';
		var netStr = (netCash >= 0 ? '+$' : '-$') + Math.abs(netCash);
		sumEl.className = 'trade-summary';
		sumEl.innerHTML =
			'<div>' + I18N.escape(givesLine.trim()) + '</div>' +
			'<div>' + I18N.escape(getsLine.trim())  + '</div>' +
			'<div>' + I18N.escape(t('trade.summaryNet')) + ': ' +
			'<span class="' + netCls + '">' + netStr + '</span></div>';
	}
	// Re-render summary as the user edits cash amounts.
	document.getElementById('trade-leftp-money').addEventListener('input',  __updateTradeSummary);
	document.getElementById('trade-rightp-money').addEventListener('input', __updateTradeSummary);

	// Resolve a CSS custom property (--token) at call time. Cached after the
	// first resolution. Falls back to the second arg if the var is empty.
	var __borderMutedCache = null, __nameMutedCache = null;
	function __getBorderMuted() {
		if (__borderMutedCache !== null) return __borderMutedCache;
		try {
			var v = getComputedStyle(document.documentElement).getPropertyValue('--ink-muted').trim();
			__borderMutedCache = v || '#9A8E78';
		} catch (e) { __borderMutedCache = '#9A8E78'; }
		return __borderMutedCache;
	}
	function __getNameMuted() {
		if (__nameMutedCache !== null) return __nameMutedCache;
		try {
			var v = getComputedStyle(document.documentElement).getPropertyValue('--ink-faint').trim();
			__nameMutedCache = v || '#A8A192';
		} catch (e) { __nameMutedCache = '#A8A192'; }
		return __nameMutedCache;
	}

	// One row of the trade panel — replaces 4 near-identical sub-blocks that
	// used to live in resetTrade. opts:
	//   side:       'left' | 'right'
	//   index:      0..39 for properties, 40 for CC jail card, 41 for Chance jail card
	//   kind:       'property' | 'card'
	//   label:      string for the name column
	//   color:      background color of the swatch
	//   borderUseColor: true → border = color, false → border = muted token
	//   mortgaged:  bool (only meaningful when kind === 'property')
	//   propertyIndex: number to attach for showdeed hover (kind 'property' only)
	//   onRowClick: function (the tableRowOnClick shared handler)
	function __buildTradeRow(opts) {
		var row = document.createElement('tr');
		row.onclick = opts.onRowClick;

		var cellCb = row.appendChild(document.createElement('td'));
		cellCb.className = 'propertycellcheckbox';
		var checkbox = cellCb.appendChild(document.createElement('input'));
		checkbox.type = 'checkbox';
		checkbox.id = 'trade' + opts.side + 'checkbox' + opts.index;
		checkbox.title = (opts.kind === 'card')
			? t('trade.includeCardTitle')
			: t('trade.includePropertyTitle', { place: opts.label });

		var cellColor = row.appendChild(document.createElement('td'));
		cellColor.className = 'propertycellcolor';
		cellColor.style.backgroundColor = opts.color;
		cellColor.style.borderColor = opts.borderUseColor ? opts.color : __getBorderMuted();
		if (opts.kind === 'property') {
			cellColor.propertyIndex = opts.propertyIndex;
			cellColor.onmouseover = function () { showdeed(this.propertyIndex); };
			cellColor.onmouseout  = hidedeed;
		}

		var cellName = row.appendChild(document.createElement('td'));
		cellName.className = 'propertycellname';
		if (opts.mortgaged) {
			cellName.title = t('stats.mortgagedTooltip');
			cellName.style.color = __getNameMuted();
		}
		cellName.textContent = opts.label;
		return row;
	}

	var resetTrade = function(initiator, recipient, allowRecipientToBeChanged) {
		var currentSquare;
		var nameSelect;
		var currentOption;
		var allGroupUninproved;
		var currentName;

		var tableRowOnClick = function(e) {
			var checkboxElement = this.firstChild.firstChild;

			if (checkboxElement !== e.target) {
				checkboxElement.checked = !checkboxElement.checked;
			}

			$("#proposetradebutton").show();
			$("#canceltradebutton").show();
			$("#accepttradebutton").hide();
			$("#rejecttradebutton").hide();
			if (typeof __updateTradeSummary === 'function') __updateTradeSummary();
		};

		var initiatorProperty = document.getElementById("trade-leftp-property");
		var recipientProperty = document.getElementById("trade-rightp-property");

		currentInitiator = initiator;
		currentRecipient = recipient;

		// Empty elements.
		while (initiatorProperty.lastChild) {
			initiatorProperty.removeChild(initiatorProperty.lastChild);
		}

		while (recipientProperty.lastChild) {
			recipientProperty.removeChild(recipientProperty.lastChild);
		}

		var initiatorSideTable = document.createElement("table");
		var recipientSideTable = document.createElement("table");


		for (var i = 0; i < 40; i++) {
			currentSquare = square[i];

			// A property cannot be traded if any properties in its group have been improved.
			if (currentSquare.house > 0 || currentSquare.groupNumber === 0) {
				continue;
			}

			allGroupUninproved = true;
			var max = currentSquare.group.length;
			for (var j = 0; j < max; j++) {

				if (square[currentSquare.group[j]].house > 0) {
					allGroupUninproved = false;
					break;
				}
			}

			if (!allGroupUninproved) {
				continue;
			}

			// Railroads (group 1) and utilities (group 2) get a muted swatch border
			// so they read as "no monopoly group". All other groups border = color.
			var borderUseColor = !(currentSquare.groupNumber == 1 || currentSquare.groupNumber == 2);
			if (currentSquare.owner === initiator.index) {
				initiatorSideTable.appendChild(__buildTradeRow({
					side: 'left', index: i, kind: 'property',
					label: currentSquare.name, color: currentSquare.color,
					borderUseColor: borderUseColor, mortgaged: !!currentSquare.mortgage,
					propertyIndex: i, onRowClick: tableRowOnClick
				}));
			} else if (currentSquare.owner === recipient.index) {
				recipientSideTable.appendChild(__buildTradeRow({
					side: 'right', index: i, kind: 'property',
					label: currentSquare.name, color: currentSquare.color,
					borderUseColor: borderUseColor, mortgaged: !!currentSquare.mortgage,
					propertyIndex: i, onRowClick: tableRowOnClick
				}));
			}
		}

		// Jail cards — one row per card a side currently holds.
		if (initiator.communityChestJailCard) {
			initiatorSideTable.appendChild(__buildTradeRow({
				side: 'left', index: 40, kind: 'card',
				label: t('stats.gojfCard'), color: 'white',
				borderUseColor: false, onRowClick: tableRowOnClick
			}));
		} else if (recipient.communityChestJailCard) {
			recipientSideTable.appendChild(__buildTradeRow({
				side: 'right', index: 40, kind: 'card',
				label: t('stats.gojfCard'), color: 'white',
				borderUseColor: false, onRowClick: tableRowOnClick
			}));
		}
		if (initiator.chanceJailCard) {
			initiatorSideTable.appendChild(__buildTradeRow({
				side: 'left', index: 41, kind: 'card',
				label: t('stats.gojfCard'), color: 'white',
				borderUseColor: false, onRowClick: tableRowOnClick
			}));
		} else if (recipient.chanceJailCard) {
			recipientSideTable.appendChild(__buildTradeRow({
				side: 'right', index: 41, kind: 'card',
				label: t('stats.gojfCard'), color: 'white',
				borderUseColor: false, onRowClick: tableRowOnClick
			}));
		}

		if (initiatorSideTable.lastChild) {
			initiatorProperty.appendChild(initiatorSideTable);
		} else {
			initiatorProperty.textContent = t('trade.noProperties', { player: initiator.name });
		}

		if (recipientSideTable.lastChild) {
			recipientProperty.appendChild(recipientSideTable);
		} else {
			recipientProperty.textContent = t('trade.noProperties', { player: recipient.name });
		}

		document.getElementById("trade-leftp-name").textContent = initiator.name;

		currentName = document.getElementById("trade-rightp-name");

		if (allowRecipientToBeChanged && pcount > 2) {
			// Empty element.
			while (currentName.lastChild) {
				currentName.removeChild(currentName.lastChild);
			}

			nameSelect = currentName.appendChild(document.createElement("select"));
			for (var i = 1; i <= pcount; i++) {
				if (i === initiator.index) {
					continue;
				}

				currentOption = nameSelect.appendChild(document.createElement("option"));
				currentOption.value = i + "";
				currentOption.style.color = player[i].color;
				currentOption.textContent = player[i].name;

				if (i === recipient.index) {
					currentOption.selected = "selected";
				}
			}

			nameSelect.onchange = function() {
				resetTrade(currentInitiator, player[parseInt(this.value, 10)], true);
			};

			nameSelect.title = t('trade.selectPlayerTitle');
		} else {
			currentName.textContent = recipient.name;
		}

		document.getElementById("trade-leftp-money").value = "0";
		document.getElementById("trade-rightp-money").value = "0";

	};

	var readTrade = function() {
		var initiator = currentInitiator;
		var recipient = currentRecipient;
		var property = new Array(40);
		var money;
		var communityChestJailCard;
		var chanceJailCard;

		// Cache lookups: previously each iteration did 2-4 getElementById
		// calls on the same id. Cache once per row.
		for (var i = 0; i < 40; i++) {
			var leftCb  = document.getElementById("tradeleftcheckbox"  + i);
			var rightCb = document.getElementById("traderightcheckbox" + i);
			if (leftCb && leftCb.checked) {
				property[i] = 1;
			} else if (rightCb && rightCb.checked) {
				property[i] = -1;
			} else {
				property[i] = 0;
			}
		}

		if (document.getElementById("tradeleftcheckbox40") && document.getElementById("tradeleftcheckbox40").checked) {
			communityChestJailCard = 1;
		} else if (document.getElementById("traderightcheckbox40") && document.getElementById("traderightcheckbox40").checked) {
			communityChestJailCard = -1;
		} else {
			communityChestJailCard = 0;
		}

		if (document.getElementById("tradeleftcheckbox41") && document.getElementById("tradeleftcheckbox41").checked) {
			chanceJailCard = 1;
		} else if (document.getElementById("traderightcheckbox41") && document.getElementById("traderightcheckbox41").checked) {
			chanceJailCard = -1;
		} else {
			chanceJailCard = 0;
		}

		money = parseInt(document.getElementById("trade-leftp-money").value, 10) || 0;
		money -= parseInt(document.getElementById("trade-rightp-money").value, 10) || 0;

		var trade = new Trade(initiator, recipient, money, property, communityChestJailCard, chanceJailCard);

		return trade;
	};

	var writeTrade = function(tradeObj) {
		resetTrade(tradeObj.getInitiator(), tradeObj.getRecipient(), false);

		// Cache lookups: same id was queried up to 3 times per cell.
		for (var i = 0; i < 40; i++) {
			var leftCb = document.getElementById("tradeleftcheckbox" + i);
			if (leftCb) leftCb.checked = (tradeObj.getProperty(i) === 1);
			var rightCb = document.getElementById("traderightcheckbox" + i);
			if (rightCb) rightCb.checked = (tradeObj.getProperty(i) === -1);
		}

		if (document.getElementById("tradeleftcheckbox40")) {
			if (tradeObj.getCommunityChestJailCard() === 1) {
				document.getElementById("tradeleftcheckbox40").checked = true;
			} else {
				document.getElementById("tradeleftcheckbox40").checked = false;
			}
		}

		if (document.getElementById("traderightcheckbox40")) {
			if (tradeObj.getCommunityChestJailCard() === -1) {
				document.getElementById("traderightcheckbox40").checked = true;
			} else {
				document.getElementById("traderightcheckbox40").checked = false;
			}
		}

		if (document.getElementById("tradeleftcheckbox41")) {
			if (tradeObj.getChanceJailCard() === 1) {
				document.getElementById("tradeleftcheckbox41").checked = true;
			} else {
				document.getElementById("tradeleftcheckbox41").checked = false;
			}
		}

		if (document.getElementById("traderightcheckbox41")) {
			if (tradeObj.getChanceJailCard() === -1) {
				document.getElementById("traderightcheckbox41").checked = true;
			} else {
				document.getElementById("traderightcheckbox41").checked = false;
			}
		}

		if (tradeObj.getMoney() > 0) {
			document.getElementById("trade-leftp-money").value = tradeObj.getMoney() + "";
		} else {
			document.getElementById("trade-rightp-money").value = (-tradeObj.getMoney()) + "";
		}

	};

	this.trade = function(tradeObj) {
		// AI-to-AI: settle the negotiation without ever showing the human UI.
		if (tradeObj instanceof Trade) {
			var tInit = tradeObj.getInitiator();
			var tRecip = tradeObj.getRecipient();
			if (tInit && tRecip && !tInit.human && !tRecip.human) {
				var resp = tRecip.AI.acceptTrade(tradeObj);
				if (resp === true) {
					popup("<p>" + t('popup.tradeAccepted', { recipient: tRecip.name }) + "</p>");
					var revProps = [];
					for (var ri = 0; ri < 40; ri++) revProps[ri] = -tradeObj.getProperty(ri);
					var reversed = new Trade(tRecip, tInit, -tradeObj.getMoney(), revProps, -tradeObj.getCommunityChestJailCard(), -tradeObj.getChanceJailCard());
					this.acceptTrade(reversed);
				} else if (resp instanceof Trade) {
					popup("<p>" + t('popup.tradeCounter', { recipient: tRecip.name }) + "</p>");
					this.trade(resp);
				} else {
					popup("<p>" + t('popup.tradeDeclined', { recipient: tRecip.name }) + "</p>");
				}
				return;
			}
		}

		$("#board").hide();
		$("#control").hide();
		$("#trade").show();
		$("#proposetradebutton").show();
		$("#canceltradebutton").show();
		$("#accepttradebutton").hide();
		$("#rejecttradebutton").hide();

		if (tradeObj instanceof Trade) {
			writeTrade(tradeObj);
			this.proposeTrade();
		} else {
			var initiator = player[turn];
			var recipient = turn === 1 ? player[2] : player[1];

			currentInitiator = initiator;
			currentRecipient = recipient;

			resetTrade(initiator, recipient, true);
		}
	};


	this.cancelTrade = function() {
		$("#board").show();
		$("#control").show();
		$("#trade").hide();


		if (!player[turn].human) {
			player[turn].AI.alertList = "";
			game.next();
		}

	};

	this.acceptTrade = function(tradeObj) {
		if (isNaN(document.getElementById("trade-leftp-money").value)) {
			document.getElementById("trade-leftp-money").value = t('trade.invalidNumber');
			document.getElementById("trade-leftp-money").style.color = "red";
			return false;
		}

		if (isNaN(document.getElementById("trade-rightp-money").value)) {
			document.getElementById("trade-rightp-money").value = t('trade.invalidNumber');
			document.getElementById("trade-rightp-money").style.color = "red";
			return false;
		}

		var showAlerts = true;
		var money;
		var initiator;
		var recipient;

		if (tradeObj) {
			showAlerts = false;
		} else {
			tradeObj = readTrade();
		}

		money = tradeObj.getMoney();
		initiator = tradeObj.getInitiator();
		recipient = tradeObj.getRecipient();


		if (money > 0 && money > initiator.money) {
			document.getElementById("trade-leftp-money").value = t('trade.notEnoughMoney', { player: initiator.name, amount: money });
			document.getElementById("trade-leftp-money").style.color = "red";
			return false;
		} else if (money < 0 && -money > recipient.money) {
			document.getElementById("trade-rightp-money").value = t('trade.notEnoughMoney', { player: recipient.name, amount: -money });
			document.getElementById("trade-rightp-money").style.color = "red";
			return false;
		}

		var isAPropertySelected = 0;

		// Ensure that some properties are selected.
		for (var i = 0; i < 40; i++) {
			isAPropertySelected |= tradeObj.getProperty(i);
		}

		isAPropertySelected |= tradeObj.getCommunityChestJailCard();
		isAPropertySelected |= tradeObj.getChanceJailCard();

		if (isAPropertySelected === 0) {
			popup("<p>" + t('popup.tradeNoProperties') + "</p>");

			return false;
		}

		if (showAlerts && !confirm(t('popup.tradeConfirm', { initiator: initiator.name, recipient: recipient.name }))) {
			return false;
		}

		// Exchange properties
		for (var i = 0; i < 40; i++) {

			if (tradeObj.getProperty(i) === 1) {
				square[i].owner = recipient.index;
				addAlert(t('alert.receivedProperty', { recipient: recipient.name, place: square[i].name, initiator: initiator.name }));
			} else if (tradeObj.getProperty(i) === -1) {
				square[i].owner = initiator.index;
				addAlert(t('alert.receivedProperty', { recipient: initiator.name, place: square[i].name, initiator: recipient.name }));
			}

		}

		if (tradeObj.getCommunityChestJailCard() === 1) {
			initiator.communityChestJailCard = false;
			recipient.communityChestJailCard = true;
			addAlert(t('alert.receivedJailCard', { recipient: recipient.name, initiator: initiator.name }));
		} else if (tradeObj.getCommunityChestJailCard() === -1) {
			initiator.communityChestJailCard = true;
			recipient.communityChestJailCard = false;
			addAlert(t('alert.receivedJailCard', { recipient: initiator.name, initiator: recipient.name }));
		}

		if (tradeObj.getChanceJailCard() === 1) {
			initiator.chanceJailCard = false;
			recipient.chanceJailCard = true;
			addAlert(t('alert.receivedJailCard', { recipient: recipient.name, initiator: initiator.name }));
		} else if (tradeObj.getChanceJailCard() === -1) {
			initiator.chanceJailCard = true;
			recipient.chanceJailCard = false;
			addAlert(t('alert.receivedJailCard', { recipient: initiator.name, initiator: recipient.name }));
		}

		// Exchange money.
		if (money > 0) {
			initiator.pay(money, recipient.index);
			recipient.money += money;

			addAlert(t('alert.receivedMoneyFrom', { recipient: recipient.name, amount: money, initiator: initiator.name }));
		} else if (money < 0) {
			money = -money;

			recipient.pay(money, initiator.index);
			initiator.money += money;

			addAlert(t('alert.receivedMoneyFrom', { recipient: initiator.name, amount: money, initiator: recipient.name }));
		}

		updateOwned();
		updateMoney();

		// Sprint 3 (S3.2) — scan the just-transferred properties for any
		// color groups that became monopolies as a result of the trade.
		// We dedupe by groupNumber so a 3-property trade closing the same
		// group only bursts once.
		(function () {
			if (typeof __burstConfetti !== 'function') return;
			var firedGroups = {};
			for (var ti = 0; ti < 40; ti++) {
				var flag = tradeObj.getProperty(ti);
				if (flag === 0) continue;
				var movedTo = (flag === 1) ? recipient.index : initiator.index;
				var sq = square[ti];
				if (!sq || sq.groupNumber < 3) continue;
				if (firedGroups[sq.groupNumber]) continue;
				if (__completesColorGroupNow(sq, movedTo)) {
					firedGroups[sq.groupNumber] = true;
					var cellEl = document.getElementById('cell' + ti);
					if (cellEl) {
						__burstConfetti(cellEl, [sq.color || '#1B5E3F', '#FFD24A', '#FFFFFF']);
					}
				}
			}
		})();

		$("#board").show();
		$("#control").show();
		$("#trade").hide();

		if (!player[turn].human) {
			player[turn].AI.alertList = "";
			game.next();
		}
	};

	this.proposeTrade = function() {
		if (isNaN(document.getElementById("trade-leftp-money").value)) {
			document.getElementById("trade-leftp-money").value = t('trade.invalidNumber');
			document.getElementById("trade-leftp-money").style.color = "red";
			return false;
		}

		if (isNaN(document.getElementById("trade-rightp-money").value)) {
			document.getElementById("trade-rightp-money").value = t('trade.invalidNumber');
			document.getElementById("trade-rightp-money").style.color = "red";
			return false;
		}

		var tradeObj = readTrade();
		var money = tradeObj.getMoney();
		var initiator = tradeObj.getInitiator();
		var recipient = tradeObj.getRecipient();
		var reversedTradeProperty = [];

		if (money > 0 && money > initiator.money) {
			document.getElementById("trade-leftp-money").value = t('trade.notEnoughMoney', { player: initiator.name, amount: money });
			document.getElementById("trade-leftp-money").style.color = "red";
			return false;
		} else if (money < 0 && -money > recipient.money) {
			document.getElementById("trade-rightp-money").value = t('trade.notEnoughMoney', { player: recipient.name, amount: -money });
			document.getElementById("trade-rightp-money").style.color = "red";
			return false;
		}

		var isAPropertySelected = 0;

		// Ensure that some properties are selected.
		for (var i = 0; i < 40; i++) {
			reversedTradeProperty[i] = -tradeObj.getProperty(i);
			isAPropertySelected |= tradeObj.getProperty(i);
		}

		isAPropertySelected |= tradeObj.getCommunityChestJailCard();
		isAPropertySelected |= tradeObj.getChanceJailCard();

		if (isAPropertySelected === 0) {
			popup("<p>" + t('popup.tradeNoProperties') + "</p>");

			return false;
		}

		if (initiator.human && !confirm(t('popup.tradeOfferConfirm', { initiator: initiator.name, recipient: recipient.name }))) {
			return false;
		}

		var reversedTrade = new Trade(recipient, initiator, -money, reversedTradeProperty, -tradeObj.getCommunityChestJailCard(), -tradeObj.getChanceJailCard());

		if (recipient.human) {

			writeTrade(reversedTrade);

			$("#proposetradebutton").hide();
			$("#canceltradebutton").hide();
			$("#accepttradebutton").show();
			$("#rejecttradebutton").show();

			addAlert(t('alert.tradeInitiated', { initiator: initiator.name, recipient: recipient.name }));
			popup("<p>" + t('popup.tradeProposed', { initiator: initiator.name, recipient: recipient.name }) + "</p>");
		} else {
			var tradeResponse = recipient.AI.acceptTrade(tradeObj);

			if (tradeResponse === true) {
				popup("<p>" + t('popup.tradeAccepted', { recipient: recipient.name }) + "</p>");
				this.acceptTrade(reversedTrade);
			} else if (tradeResponse === false) {
				popup("<p>" + t('popup.tradeDeclined', { recipient: recipient.name }) + "</p>");
				return;
			} else if (tradeResponse instanceof Trade) {
				popup("<p>" + t('popup.tradeCounter', { recipient: recipient.name }) + "</p>");
				// AI initiator + AI counter-offer: hand back to game.trade() which
				// will resolve it headlessly via the AI-only branch. Human never
				// sees the trade panel.
				if (!initiator.human) {
					$("#board").show();
					$("#control").show();
					$("#trade").hide();
					game.trade(tradeResponse);
					return;
				}
				writeTrade(tradeResponse);

				$("#proposetradebutton, #canceltradebutton").hide();
				$("#accepttradebutton").show();
				$("#rejecttradebutton").show();
			}
		}
	};



	// Bankrupcy functions:




	this.eliminatePlayer = function() {
		var p = player[turn];

		// Animate the eliminated player out BEFORE we reshuffle indices so we
		// can target the correct token and money-bar row.
		if (typeof __animateEliminate === 'function') __animateEliminate(turn);

		for (var i = turn; i < pcount; i++) {
			player[i] = player[i + 1];
			player[i].index = i;
		}

		for (var i = 0; i < 40; i++) {
			if (square[i].owner > turn) {
				square[i].owner--;
			}
		}

		pcount--;
		turn--;
		if (turn < 1) {
			turn = pcount;
		}

		if (pcount === 2) {
			document.getElementById("stats").style.width = "454px";
		} else if (pcount === 3) {
			document.getElementById("stats").style.width = "686px";
		}

		if (pcount === 1) {
			updateMoney();
			$("#control").hide();
			$("#board").hide();
			$("#refresh").show();

			// // Display land counts for survey purposes.
			// var text;
			// for (var i = 0; i < 40; i++) {
				// if (i === 0)
					// text = square[i].landcount;
				// else
					// text += " " + square[i].landcount;
			// }
			// document.getElementById("refresh").innerHTML += "<br><br><div><textarea type='text' style='width: 980px;' onclick='javascript:select();' />" + text + "</textarea></div>";

			// Cinematic victory overlay (crown + name reveal + golden rays + confetti).
			// Falls back to the old popup if the overlay helper isn't available.
			if (typeof __showVictory === 'function') {
				__showVictory(player[1]);
			} else {
				popup("<p>" + t('popup.won', { player: player[1].name }) + "</p><div>");
				__launchConfetti();
			}

		} else {
			play();
		}
	};

	this.bankruptcyUnmortgage = function() {
		var p = player[turn];

		if (p.creditor === 0) {
			game.eliminatePlayer();
			return;
		}

		var creditor = p.creditor;
		var creditorPlayer = player[creditor];
		var mortgaged = [];
		var sq;

		for (var i = 0; i < 40; i++) {
			sq = square[i];
			if (sq.owner == p.index && sq.mortgage) {
				mortgaged.push(i);
				sq.owner = creditor;
			}
		}

		if (!creditorPlayer.human) {
			var SAFETY_BUFFER = 200;
			for (var m = 0; m < mortgaged.length; m++) {
				var idx = mortgaged[m];
				var s2 = square[idx];
				// Bankruptcy path pays mortgage value (50%) to clear it, matching
				// the interactive popup the human creditor sees on the same flow.
				var cost = Math.round(s2.price * 0.5);
				var groupOwned = 0;
				for (var g = 0; g < 40; g++) {
					if (square[g].groupNumber === s2.groupNumber && square[g].owner === creditor) groupOwned++;
				}
				if (groupOwned >= 2 && (creditorPlayer.money - cost) >= SAFETY_BUFFER) {
					creditorPlayer.pay(cost, 0);
					s2.mortgage = false;
					addAlert(t('alert.unmortgaged', { player: creditorPlayer.name, place: s2.name, amount: cost }));
					if (typeof __updateMortgagedVisual === 'function') __updateMortgagedVisual(idx);
				}
			}
			updateOwned();
			updateMoney();
			game.eliminatePlayer();
			return;
		}

		var HTML = "<p>" + t('popup.bankruptcyUnmortgageNote', { recipient: creditorPlayer.name }) + "</p><table>";
		var rowIds = [];
		for (var k = 0; k < mortgaged.length; k++) {
			var i2 = mortgaged[k];
			var sq2 = square[i2];
			var price = Math.round(sq2.price * 0.5);
			var rowId = 'bunmrow-' + i2;
			rowIds.push({ rowId: rowId, idx: i2, price: price });

			HTML += "<tr id='" + rowId + "'><td class='propertycellcolor' style='background: " + sq2.color + ";";
			HTML += (sq2.groupNumber == 1 || sq2.groupNumber == 2)
				? " border: 1px solid grey;"
				: " border: 1px solid " + sq2.color + ";";

			HTML += "' onmouseover='showdeed(" + i2 + ");' onmouseout='hidedeed();'></td>";
			HTML += "<td class='propertycellname'><a href='javascript:void(0);' "
				+ "id='" + rowId + "-link' "
				+ "data-prop-index='" + i2 + "' data-prop-price='" + price + "'>"
				+ t('popup.unmortgageProp', { place: sq2.name, amount: price }) + "</a></td></tr>";
		}

		HTML += "</table>";

		popup(HTML, game.eliminatePlayer);

		// Wire up the link click handlers AFTER popup() inserts the HTML.
		// This avoids inline-onclick string concat (which broke on player names
		// containing quotes) and lets us translate the alert text cleanly.
		for (var k = 0; k < rowIds.length; k++) {
			(function (info) {
				var link = document.getElementById(info.rowId + '-link');
				var row = document.getElementById(info.rowId);
				if (!link || !row) return;
				link.title = t('popup.unmortgageTitle', { place: square[info.idx].name, amount: info.price });
				link.addEventListener('click', function () {
					if (info.price <= player[creditor].money) {
						player[creditor].pay(info.price, 0);
						square[info.idx].mortgage = false;
						addAlert(t('alert.unmortgaged', {
							player: player[creditor].name,
							place: square[info.idx].name,
							amount: info.price
						}));
						// Sync the board overlay and money bar — without this, the
						// red stripes stayed on the cell even after the mortgage was
						// cleared, forcing the user to re-mortgage to refresh them.
						if (typeof __updateMortgagedVisual === 'function') __updateMortgagedVisual(info.idx);
						updateOwned();
						updateMoney();
					}
					row.style.display = 'none';
				});
			})(rowIds[k]);
		}
	};

	this.resign = function() {
		// Build a richer confirmation showing exactly what the player loses.
		var p = player[turn];
		var ownedCount = 0;
		var totalValue = 0;
		for (var i = 0; i < 40; i++) {
			if (square[i].owner === turn) {
				ownedCount++;
				totalValue += square[i].price + (square[i].house || 0) * (square[i].houseprice || 0)
				              + (square[i].hotel ? (square[i].houseprice || 0) * 5 : 0);
			}
		}
		var recipient = (p.creditor && p.creditor !== 0 && player[p.creditor])
			? player[p.creditor].name
			: t('popup.resignBank');
		var html =
			'<p><strong>' + t('popup.resignConfirm') + '</strong></p>' +
			'<p style="margin-top:8px; color:var(--ink-muted); font-size:12px; line-height:1.5;">' +
				tn('popup.resignDetails', ownedCount, {
					value: totalValue,
					recipient: recipient
				}) +
			'</p>';
		popup(html, game.bankruptcy, "Yes/No");
	};

	this.bankruptcy = function() {
		var p = player[turn];
		var pcredit = player[p.creditor];
		var bankruptcyUnmortgageFee = 0;


		if (p.money >= 0) {
			return;
		}

		addAlert(t('alert.bankrupt', { player: p.name }));
		// Sprint 1 (S1.4e) — dramatic triple-buzz on bankruptcy.
		if (typeof __haptic === 'function') __haptic([200, 100, 200]);
		// Sprint 2 (S2.2b) — heavy screen-shake to punctuate elimination.
		if (typeof __shake === 'function') __shake(10, 600);

		if (p.creditor !== 0) {
			pcredit.money += p.money;
		}

		for (var i = 0; i < 40; i++) {
			var sq = square[i];
			if (sq.owner == p.index) {
				// Mortgaged properties will be tranfered by bankruptcyUnmortgage();
				if (!sq.mortgage) {
					sq.owner = p.creditor;
				} else {
					bankruptcyUnmortgageFee += Math.round(sq.price * 0.1);
				}

				if (sq.house > 0) {
					if (p.creditor !== 0) {
						pcredit.money += sq.houseprice * 0.5 * sq.house;
					}
					sq.hotel = 0;
					sq.house = 0;
				}

				if (p.creditor === 0) {
					sq.mortgage = false;
					game.addPropertyToAuctionQueue(i);
					sq.owner = 0;
				}
			}
		}

		updateMoney();

		if (p.chanceJailCard) {
			p.chanceJailCard = false;
			pcredit.chanceJailCard = true;
		}

		if (p.communityChestJailCard) {
			p.communityChestJailCard = false;
			pcredit.communityChestJailCard = true;
		}

		if (pcount === 2 || bankruptcyUnmortgageFee === 0 || p.creditor === 0) {
			game.eliminatePlayer();
		} else {
			addAlert(t('alert.bankruptcyInterest', { recipient: pcredit.name, amount: bankruptcyUnmortgageFee, player: p.name }));
			popup("<p>" + t('popup.payInterest', { recipient: pcredit.name, amount: bankruptcyUnmortgageFee, player: p.name }) + "</p>", function() {player[pcredit.index].pay(bankruptcyUnmortgageFee, 0); game.bankruptcyUnmortgage();});
		}
	};

}

var game;

