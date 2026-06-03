// =====================================================================
// monopoly.js — Sprint 5 slim shell. Game-action logic + setup wiring.
// Companion modules (loaded BEFORE this file in index.html):
//   engine.js      Game() constructor + bootstrap namespaces.
//   players.js     Player/Trade + global player state.
//   animations.js  motion / visual feedback / token layer.
//   render.js      money bar / dice / owned list rendering.
// This file holds: color-group visuals, chance / community chest,
// addamount/subtractamount, jail, advance, street repairs, buy /
// mortgage / unmortgage, land(), roll(), play(), setup(), and the
// window.onload boot sequence that wires everything together.
// =====================================================================

// Walks every color-group cell and toggles .cell-group-mono on cells that
// belong to a player who owns the full group. Sets --group-owner-color so
// the CSS glow tints to match the owner.
function __refreshGroupVisuals() {
	// First clear all existing monopoly classes.
	for (var i = 0; i < 40; i++) {
		var c = document.getElementById('cell' + i);
		if (c) c.classList.remove('cell-group-mono');
	}

	// Detect monopolies group by group. Each color-group's first encountered
	// member's `group` array contains all its indices.
	var seen = {};
	for (var j = 0; j < 40; j++) {
		var sq = square[j];
		if (!sq || sq.groupNumber < 3 || !sq.group || seen[sq.groupNumber]) continue;
		seen[sq.groupNumber] = true;

		// All cells in the group must be owned by the same non-zero player.
		var owner = square[sq.group[0]].owner;
		if (owner === 0) continue;
		var allSame = true;
		for (var k = 1; k < sq.group.length; k++) {
			if (square[sq.group[k]].owner !== owner) { allSame = false; break; }
		}
		if (!allSame) continue;

		// Apply class + owner color CSS variable to each cell of the group.
		var ownerColor = (player[owner] && player[owner].color) || '#888';
		for (var m = 0; m < sq.group.length; m++) {
			var cellEl = document.getElementById('cell' + sq.group[m]);
			if (cellEl) {
				cellEl.classList.add('cell-group-mono');
				cellEl.style.setProperty('--group-owner-color', ownerColor);
			}
		}
	}
}

// Adds .popup-card to trigger the card-flip entrance and removes it the
// moment the animation ends, so the lingering `transform: perspective(...)`
// doesn't create a 3D rendering context that intercepts clicks on the OK
// button on some browsers (Chrome/Edge in particular).
// Chance / Community Chest popups should LOOK like physical Monopoly cards
// the entire time they're on screen, not just during their flip-in. Adding
// .popup-card here switches on the cream-paper styling + larger sizing; the
// class is removed automatically the next time popup() runs (it starts each
// invocation by stripping any leftover .popup-card), so generic popups stay
// generic. Previously this function tore the class off after 600ms, which
// reverted the gorgeous tabletop look right after the entrance animation.
function __applyPopupCardOnce() {
	var popupEl = document.getElementById('popup');
	if (!popupEl) return;
	popupEl.classList.add('popup-card');

	// Sprint 2 (S2.4) — wrap the live card content in a .card-flip / .card-face
	// scaffold so the existing `card-flip-in` keyframe (rotateY 92deg → 0)
	// reveals as a proper 3D flip with a visible back side mid-animation.
	//
	// Caveats handled:
	//   • The auto-accept ring (autoMs) is already appended to #popuptext by
	//     popup() before we run, so we lift it OUT before wrapping and re-attach
	//     it AFTER, keeping it outside the 3D context (otherwise backface-
	//     visibility would hide it during the first half of the flip).
	//   • Idempotent: if .card-flip is already inside popuptext (defensive),
	//     skip re-wrapping.
	var textEl = document.getElementById('popuptext');
	if (!textEl) return;
	if (textEl.querySelector(':scope > .card-flip')) return;

	var autoRow = textEl.querySelector('.auto-accept-row');

	// Detach the auto-accept row temporarily.
	if (autoRow && autoRow.parentNode === textEl) {
		textEl.removeChild(autoRow);
	}

	// Move all remaining children into card-front.
	var flip  = document.createElement('div');
	flip.className = 'card-flip';
	var back  = document.createElement('div');
	back.className = 'card-face card-back';
	var front = document.createElement('div');
	front.className = 'card-face card-front';

	while (textEl.firstChild) {
		front.appendChild(textEl.firstChild);
	}
	flip.appendChild(back);
	flip.appendChild(front);
	textEl.appendChild(flip);

	// Re-attach the auto-accept row at the bottom, outside the flip.
	if (autoRow) {
		textEl.appendChild(autoRow);
	}
}

function chanceCommunityChest() {
	var p = player[turn];

	// Community Chest
	if (p.position === 2 || p.position === 17 || p.position === 33) {
		var communityChestIndex = communityChestCards.deck[communityChestCards.index];

		// Remove the get out of jail free card from the deck.
		if (communityChestIndex === 0) {
			communityChestCards.deck.splice(communityChestCards.index, 1);
		}

		var ccCardText = t('cc.' + communityChestIndex);
		popup("<img src='images/community_chest_icon.png' style='height: 64px; width: 68px; float: left; margin: 4px 14px 8px 0px;' /><div style='font-weight: 800; font-size: 22px; letter-spacing: 0.04em; text-transform: uppercase;'>" + t('cc.title') + "</div><div style='text-align: justify; font-size: 22px; line-height: 1.4; margin-top: 10px;'>" + ccCardText + "</div>", function() {
			communityChestAction(communityChestIndex);
		}, undefined, { autoMs: 10000 });
		__applyPopupCardOnce();
		__flashDeck('deck-cc');
		if (typeof Sound !== 'undefined') Sound.ding();
		document.getElementById("popup").classList.add("popup-card");

		communityChestCards.index++;

		if (communityChestCards.index >= communityChestCards.deck.length) {
			communityChestCards.index = 0;
		}

	// Chance
	} else if (p.position === 7 || p.position === 22 || p.position === 36) {
		var chanceIndex = chanceCards.deck[chanceCards.index];

		// Remove the get out of jail free card from the deck.
		if (chanceIndex === 0) {
			chanceCards.deck.splice(chanceCards.index, 1);
		}

		var chanceCardText = t('chance.' + chanceIndex);
		popup("<img src='images/chance_icon.png' style='height: 64px; width: 33px; float: left; margin: 4px 14px 8px 0px;' /><div style='font-weight: 800; font-size: 22px; letter-spacing: 0.04em; text-transform: uppercase;'>" + t('chance.title') + "</div><div style='text-align: justify; font-size: 22px; line-height: 1.4; margin-top: 10px;'>" + chanceCardText + "</div>", function() {
			chanceAction(chanceIndex);
		}, undefined, { autoMs: 10000 });
		__applyPopupCardOnce();
		__flashDeck('deck-chance');
		if (typeof Sound !== 'undefined') Sound.ding();
		document.getElementById("popup").classList.add("popup-card");

		chanceCards.index++;

		if (chanceCards.index >= chanceCards.deck.length) {
			chanceCards.index = 0;
		}
	} else {
		if (!p.human) {
			p.AI.alertList = "";

			if (!p.AI.onLand()) {
				game.next();
			}
		}
	}
}

function chanceAction(chanceIndex) {
	var p = player[turn]; // This is needed for reference in action() method.

	// $('#popupbackground').hide();
	// $('#popupwrap').hide();
	chanceCards[chanceIndex].action(p);

	updateMoney();

	if (chanceIndex !== 15 && !p.human) {
		p.AI.alertList = "";
		game.next();
	}
}

function communityChestAction(communityChestIndex) {
	var p = player[turn]; // This is needed for reference in action() method.

	// $('#popupbackground').hide();
	// $('#popupwrap').hide();
	communityChestCards[communityChestIndex].action(p);

	updateMoney();

	if (communityChestIndex !== 15 && !p.human) {
		p.AI.alertList = "";
		game.next();
	}
}

function addamount(amount, cause) {
	var p = player[turn];

	p.money += amount;

	// `cause` is 'Chance' or 'Community Chest' passed from card actions; map to translated label.
	var causeKey = (cause === 'Chance') ? 'source.chance' : (cause === 'Community Chest') ? 'source.cc' : null;
	var causeLabel = causeKey ? t(causeKey) : cause;
	addAlert(t('alert.received', { player: p.name, amount: amount, cause: causeLabel }));
}

function subtractamount(amount, cause) {
	var p = player[turn];

	p.pay(amount, 0);

	var causeKey = (cause === 'Chance') ? 'source.chance' : (cause === 'Community Chest') ? 'source.cc' : null;
	var causeLabel = causeKey ? t(causeKey) : cause;
	addAlert(t('alert.lost', { player: p.name, amount: amount, cause: causeLabel }));
}

function gotojail() {
	var p = player[turn];
	addAlert(t('alert.sentToJail', { player: p.name }));
	document.getElementById("landed").innerHTML = t('landed.inJail');
	// Police siren sample — recorded clip, gracefully no-ops if muted or
	// the file fails to load.
	if (typeof Sound !== 'undefined' && Sound.sirenSample) Sound.sirenSample();
	// Sprint 1 (S1.4d) — long buzz when the police siren hits.
	if (typeof __haptic === 'function') __haptic([300]);

	p.jail = true;
	doublecount = 0;

	document.getElementById("nextbutton").value = t('ui.endTurn');
	document.getElementById("nextbutton").title = t('ui.endTurnTitle');

	if (p.human) {
		document.getElementById("nextbutton").focus();
	}

	updatePosition();
	updateOwned();

	if (!p.human) {
		__showAIRecapToast(p);
		p.AI.alertList = "";
		game.next();
	}
}

function gobackthreespaces() {
	var p = player[turn];

	p.position -= 3;
	// Wrap around if we go before GO. (Chance card 4 from positions 0-2.)
	if (p.position < 0) p.position += 40;

	// Keep the token visually in sync with the logical position. Without
	// this, the next walk would start from the old visual cell while
	// startPos = p.position points to the new one — the bug that made the
	// token appear to "skip" cells.
	if (typeof __snapTokenToPosition === 'function') __snapTokenToPosition(turn);

	land();
}

function payeachplayer(amount, cause) {
	var p = player[turn];
	var total = 0;

	for (var i = 1; i <= pcount; i++) {
		if (i === turn) continue;

		if (p.money >= amount) {
			// Full payment — debit first, credit the opponent only on success.
			p.pay(amount, i);
			player[i].money += amount;
			total += amount;
		} else {
			// Insufficient: transfer whatever cash is left to this opponent,
			// then register them as the creditor and let the bankruptcy/resign
			// flow distribute remaining assets. Subsequent opponents get
			// nothing — assets cover only one creditor here.
			var remaining = Math.max(0, p.money);
			if (remaining > 0) {
				player[i].money += remaining;
				total += remaining;
			}
			// Mark the unpaid balance as debt to opponent i.
			p.money -= amount;
			p.creditor = i;
			break;
		}
	}

	updateMoney();
	var causeKey = (cause === 'Chance') ? 'source.chance' : (cause === 'Community Chest') ? 'source.cc' : null;
	var causeLabel = causeKey ? t(causeKey) : cause;
	addAlert(t('alert.lost', { player: p.name, amount: total, cause: causeLabel }));
}

function collectfromeachplayer(amount, cause) {
	var p = player[turn];
	var total = 0;

	for (var i = 1; i <= pcount; i++) {
		if (i != turn) {
			var money = player[i].money;
			if (money < amount) {
				p.money += money;
				total += money;
				player[i].money = 0;
			} else {
				player[i].pay(amount, turn);
				p.money += amount;
				total += amount;
			}
		}
	}

	var causeKey = (cause === 'Chance') ? 'source.chance' : (cause === 'Community Chest') ? 'source.cc' : null;
	var causeLabel = causeKey ? t(causeKey) : cause;
	addAlert(t('alert.received', { player: p.name, amount: total, cause: causeLabel }));
}

function advance(destination, pass) {
	// `pass` is a legacy waypoint hint (only NYC uses it). Forward-wrap
	// detection against the final destination handles all cases uniformly,
	// so we ignore it to avoid the double-GO bug it produced.
	void pass;

	var p = player[turn];
	// Tokens move forward only. We cross GO iff destination wraps past 0
	// (destination < current position), or we land directly on GO from
	// somewhere else.
	var passGO = (destination < p.position) || (destination === 0 && p.position !== 0);

	p.position = destination;

	if (passGO) {
		p.money += 200;
		addAlert(t('alert.collectedSalary', { player: p.name }));
		if (typeof UI !== 'undefined') UI.toast(t('alert.collectedSalary', { player: p.name }), { kind: 'success' });
	}

	if (typeof __snapTokenToPosition === 'function') __snapTokenToPosition(turn);
	land();
}

function advanceToNearestUtility() {
	var p = player[turn];

	if (p.position < 12) {
		p.position = 12;
	} else if (p.position >= 12 && p.position < 28) {
		p.position = 28;
	} else if (p.position >= 28) {
		p.position = 12;
		p.money += 200;
		addAlert(t('alert.collectedSalary', { player: p.name }));
	}

	if (typeof __snapTokenToPosition === 'function') __snapTokenToPosition(turn);
	land(true);
}

function advanceToNearestRailroad() {
	var p = player[turn];

	if (p.position < 15) {
		p.position = 15;
	} else if (p.position < 25) {
		p.position = 25;
	} else if (p.position < 35) {
		p.position = 35;
	} else {
		p.position = 5;
		p.money += 200;
		addAlert(t('alert.collectedSalary', { player: p.name }));
	}

	if (typeof __snapTokenToPosition === 'function') __snapTokenToPosition(turn);
	land(true);
}

function streetrepairs(houseprice, hotelprice) {
	var cost = 0;
	for (var i = 0; i < 40; i++) {
		var s = square[i];
		if (s.owner == turn) {
			if (s.hotel == 1)
				cost += hotelprice;
			else
				cost += s.house * houseprice;
		}
	}

	var p = player[turn];

	if (cost > 0) {
		p.pay(cost, 0);

		// If function was called by Community Chest ($40/house, $115/hotel) vs Chance ($25/$100).
		var causeKey = (houseprice === 40) ? 'source.cc' : 'source.chance';
		addAlert(t('alert.lost', { player: p.name, amount: cost, cause: t(causeKey) }));
	}

}

function payfifty() {
	var p = player[turn];

	document.getElementById("jail").style.border = '1px solid black';
	document.getElementById("cell11").style.border = '2px solid ' + p.color;

	UI.$hide("landed");
	doublecount = 0;

	p.jail = false;
	p.jailroll = 0;
	p.position = 10;
	p.pay(50, 0);

	addAlert(t('alert.paidFine', { player: p.name }));
	updateMoney();
	updatePosition();
}

function useJailCard() {
	var p = player[turn];

	document.getElementById("jail").style.border = '1px solid black';
	document.getElementById("cell11").style.border = '2px solid ' + p.color;

	UI.$hide("landed");
	p.jail = false;
	p.jailroll = 0;

	p.position = 10;

	doublecount = 0;

	if (p.communityChestJailCard) {
		p.communityChestJailCard = false;

		// Insert the get out of jail free card back into the community chest deck.
		communityChestCards.deck.splice(communityChestCards.index, 0, 0);

		communityChestCards.index++;

		if (communityChestCards.index >= communityChestCards.deck.length) {
			communityChestCards.index = 0;
		}
	} else if (p.chanceJailCard) {
		p.chanceJailCard = false;

		// Insert the get out of jail free card back into the chance deck.
		chanceCards.deck.splice(chanceCards.index, 0, 0);

		chanceCards.index++;

		if (chanceCards.index >= chanceCards.deck.length) {
			chanceCards.index = 0;
		}
	}

	addAlert(t('alert.usedJailCard', { player: p.name }));
	updateOwned();
	updatePosition();
}

function buyHouse(index) {
	var sq = square[index];
	if (!sq || sq.owner === 0 || !sq.group) return false;
	var p = player[sq.owner];
	if (sq.house >= 5) return false;

	// Must own the full color group, no mortgaged lots, and even-build.
	for (var gi = 0; gi < sq.group.length; gi++) {
		var gs = square[sq.group[gi]];
		if (gs.owner !== sq.owner) return false;
		if (gs.mortgage) return false;
		// Even build: this lot's house count must be the minimum in the group.
		if (gs.house < sq.house) return false;
	}

	if (p.money < sq.houseprice) return false;

	var houseSum = 0, hotelSum = 0;
	for (var i = 0; i < 40; i++) {
		if (square[i].hotel === 1) hotelSum++;
		else                       houseSum += square[i].house;
	}

	{
		if (sq.house < 4) {
			if (houseSum >= 32) return false;
			sq.house++;
			addAlert(t('alert.placedHouse', { player: p.name, place: sq.name }));
		} else {
			if (hotelSum >= 12) return false;
			sq.house = 5;
			sq.hotel = 1;
			addAlert(t('alert.placedHotel', { player: p.name, place: sq.name }));
		}

		p.pay(sq.houseprice, 0);

		__updateBuildings(index);
		updateOwned();
		updateMoney();

		// Mark the newly-placed building so it pops in (CSS .house-fresh / .hotel-fresh).
		// updateOwned rebuilt the row, so the new element is the last house/hotel img
		// inside the property's row, identifiable by data-property-index.
		var row = document.querySelector("#owned tr[data-property-index='" + index + "']");
		if (row) {
			var freshImg;
			if (sq.hotel) {
				var hotelImgs = row.querySelectorAll("img.hotel");
				freshImg = hotelImgs[hotelImgs.length - 1];
				if (freshImg) freshImg.classList.add("hotel-fresh");
			} else {
				var houseImgs = row.querySelectorAll("img.house");
				freshImg = houseImgs[houseImgs.length - 1];
				if (freshImg) freshImg.classList.add("house-fresh");
			}
		}
	}
}

function sellHouse(index) {
	var sq = square[index];
	if (!sq || sq.owner === 0 || sq.house === 0 || !sq.group) return false;
	var p = player[sq.owner];

	// Even-sell: this lot must have the MAX house count in the group.
	for (var gi = 0; gi < sq.group.length; gi++) {
		if (square[sq.group[gi]].house > sq.house) return false;
	}

	if (sq.hotel === 1) {
		sq.hotel = 0;
		sq.house = 4;
		addAlert(t('alert.soldHotel', { player: p.name, place: sq.name }));
	} else {
		sq.house--;
		addAlert(t('alert.soldHouse', { player: p.name, place: sq.name }));
	}

	p.money += sq.houseprice * 0.5;
	__updateBuildings(index);
	updateOwned();
	updateMoney();
	return true;
}

function showStats() {
	var HTML, sq, p;
	var mortgagetext,
	housetext;
	var write;
	HTML = "<table align='center'><tr>";

	for (var x = 1; x <= pcount; x++) {
		write = false;
		p = player[x];
		if (x == 5) {
			HTML += "</tr><tr>";
		}
		// Mini-header per player card: avatar + name + cash + net worth + rank.
		var nwSafe = (typeof __computeNetWorth === 'function') ? __computeNetWorth(x) : p.money;
		var ranksMap = (typeof __computeRanks === 'function') ? __computeRanks() : {};
		var pRank = ranksMap[x] || pcount;
		var avFileStats = '';
		if (p.avatar && window.GameConfig.avatarOptions) {
			for (var aix = 0; aix < window.GameConfig.avatarOptions.length; aix++) {
				if (window.GameConfig.avatarOptions[aix].id === p.avatar) { avFileStats = window.GameConfig.avatarOptions[aix].file; break; }
			}
		}
		HTML += "<td class='statscell' id='statscell" + x + "' style='border: 2px solid " + p.color + "'>" +
			"<div class='stats-player-head'>" +
				"<div class='stats-player-avatar' style=\"background-color:" + p.color + ";" +
					(avFileStats ? "background-image:url('" + avFileStats + "');" : "") + "\"></div>" +
				"<div class='stats-player-meta'>" +
					"<div class='stats-player-name'>" + p.name + "</div>" +
					"<div class='stats-player-cash'>$" + p.money + "</div>" +
					"<div class='stats-player-sub'>" +
						"<span class='stats-player-nw'>NW $" + nwSafe + "</span>" +
						"<span class='stats-player-rank stats-rank-" + pRank + "'>#" + pRank + "</span>" +
					"</div>" +
				"</div>" +
			"</div>";

		for (var i = 0; i < 40; i++) {
			sq = square[i];

			if (sq.owner == x) {
				mortgagetext = "",
				housetext = "";

				if (sq.mortgage) {
					mortgagetext = "title='" + t('stats.mortgagedTooltip') + "' style='color: grey;'";
				}

				if (!write) {
					write = true;
					HTML += "<table>";
				}

				if (sq.house == 5) {
					housetext += "<span style='float: right; font-weight: bold;'>1&nbsp;x&nbsp;<img src='images/hotel.png' alt='' title='" + t('stats.hotelTooltip') + "' class='hotel' width='28' height='20' style='float: none;' /></span>";
				} else if (sq.house > 0 && sq.house < 5) {
					housetext += "<span style='float: right; font-weight: bold;'>" + sq.house + "&nbsp;x&nbsp;<img src='images/house.png' alt='' title='" + t('stats.houseTooltip') + "' class='house' width='26' height='20' style='float: none;' /></span>";
				}

				HTML += "<tr><td class='statscellcolor' style='background: " + sq.color + ";";

				if (sq.groupNumber == 1 || sq.groupNumber == 2) {
					HTML += " border: 1px solid grey;";
				}

				HTML += "' onmouseover='showdeed(" + i + "); __highlightBoardCell(" + i + ", true);' onmouseout='hidedeed(); __highlightBoardCell(" + i + ", false);'></td><td class='statscellname' " + mortgagetext + " onmouseover='showdeed(" + i + "); __highlightBoardCell(" + i + ", true);' onmouseout='hidedeed(); __highlightBoardCell(" + i + ", false);'>" + sq.name + housetext + "</td></tr>";
			}
		}

		if (p.communityChestJailCard) {
			if (!write) {
				write = true;
				HTML += "<table>";
			}
			HTML += "<tr><td class='statscellcolor'></td><td class='statscellname'>" + t('stats.gojfCard') + "</td></tr>";

		}
		if (p.chanceJailCard) {
			if (!write) {
				write = true;
				HTML += "<table>";
			}
			HTML += "<tr><td class='statscellcolor'></td><td class='statscellname'>" + t('stats.gojfCard') + "</td></tr>";

		}

		if (!write) {
			HTML += t('stats.noProperties', { player: p.name });
		} else {
			HTML += "</table>";
		}

		HTML += "</td>";
	}
	HTML += "</tr></table><div id='titledeed'></div>";

	document.getElementById("statstext").innerHTML = HTML;
	// Show using animation.
	UI.$fadeIn("statsbackground", 400, function () {
		UI.$show("statswrap");
	});
}

// Renders the "Owner: X" line and group ownership progress on the deed card.
// Hides both lines for unowned properties (groupless decoration looks awkward).
function __deedDecorateOwnerInfo(sq) {
	var ownerRow = document.getElementById('deed-owner-row');
	var ownerCell = document.getElementById('deed-owner-cell');
	if (!ownerRow || !ownerCell) return;

	if (sq.owner === 0) {
		ownerCell.innerHTML = '<span class="deed-owner-unowned">' +
			(typeof t === 'function' ? t('deed.unowned') : 'Unowned') + '</span>';
		ownerRow.style.display = '';
		return;
	}

	var ownerPlayer = player[sq.owner];
	if (!ownerPlayer) { ownerRow.style.display = 'none'; return; }

	// Count how many of this color group the owner holds, for "2/3 of group".
	var totalInGroup = 0;
	var ownedInGroup = 0;
	for (var i = 0; i < 40; i++) {
		if (square[i].groupNumber === sq.groupNumber) {
			totalInGroup++;
			if (square[i].owner === sq.owner) ownedInGroup++;
		}
	}

	var ownerLabel = (typeof t === 'function' ? t('deed.ownerLabel') : 'Owner');
	var dotStyle = 'background:' + ownerPlayer.color + ';';
	var pillStyle = 'background:' + ownerPlayer.color + '22; color:#1a1a1a;';
	var progressTxt = ownedInGroup + ' / ' + totalInGroup;

	ownerCell.innerHTML =
		'<div class="deed-owner-line">' +
			'<span class="deed-owner-dot" style="' + dotStyle + '"></span>' +
			'<span class="deed-owner-label">' + ownerLabel + ':</span>' +
			'<strong class="deed-owner-name">' + ownerPlayer.name + '</strong>' +
			'<span class="deed-group-pill" style="' + pillStyle + '">' + progressTxt + '</span>' +
		'</div>';
	ownerRow.style.display = '';
}

// Highlights the rent row that reflects the property's *current* state and
// writes a one-line "Current rent: $X" summary above the rent ladder.
// Rules:
//   - Hotel → rent5
//   - 1..4 houses → rent1..rent4
//   - No houses, owner has full color group → 2 × baserent
//   - No houses, no monopoly → baserent
//   - Mortgaged is handled separately upstream (the mortgaged variant shows).
function __deedHighlightCurrentRent(sq) {
	var rowIds = ['deed-row-base', 'deed-row-h1', 'deed-row-h2',
	              'deed-row-h3', 'deed-row-h4', 'deed-row-hotel'];
	for (var i = 0; i < rowIds.length; i++) {
		var row = document.getElementById(rowIds[i]);
		if (row) row.classList.remove('deed-rent-current');
	}

	var summaryRow = document.getElementById('deed-currentrent-row');
	var summaryCell = document.getElementById('deed-currentrent-cell');
	if (!summaryRow || !summaryCell) return;

	// Detect monopoly: owner controls every square in the group and none mortgaged.
	var ownsAll = sq.owner !== 0;
	if (ownsAll) {
		for (var j = 0; j < 40; j++) {
			if (square[j].groupNumber === sq.groupNumber) {
				if (square[j].owner !== sq.owner) { ownsAll = false; break; }
			}
		}
	}

	var currentRent, rowId, label;
	if (sq.hotel) {
		currentRent = sq.rent5; rowId = 'deed-row-hotel';
		label = (typeof t === 'function' ? t('deed.withHotel') : 'With HOTEL');
	} else if (sq.house >= 1) {
		var key = ['rent1', 'rent2', 'rent3', 'rent4'][sq.house - 1];
		currentRent = sq[key]; rowId = 'deed-row-h' + sq.house;
		label = sq.house + (sq.house === 1
			? (typeof t === 'function' ? ' ' + t('deed.houseSingular') : ' House')
			: (typeof t === 'function' ? ' ' + t('deed.housePlural') : ' Houses'));
	} else if (ownsAll) {
		currentRent = sq.baserent * 2; rowId = 'deed-row-base';
		label = (typeof t === 'function' ? t('deed.monopolyDouble') : 'Monopoly bonus');
	} else {
		currentRent = sq.baserent; rowId = 'deed-row-base';
		label = (typeof t === 'function' ? t('deed.base') : 'Base');
	}

	var currentTxt = (typeof t === 'function' ? t('deed.currentRent') : 'Current rent');
	summaryCell.innerHTML =
		'<span class="deed-cr-label">' + currentTxt + ':</span> ' +
		'<strong class="deed-cr-amount">$' + currentRent + '</strong>' +
		' <span class="deed-cr-sub">(' + label + ')</span>';
	summaryRow.style.display = '';

	var hot = document.getElementById(rowId);
	if (hot) hot.classList.add('deed-rent-current');
}

// Also decorate the special-tile deed (railroads, utilities) with an owner line
// but no rent ladder (those rents depend on dice / number owned, which is shown
// in the special-text block already).
function __deedDecorateSpecial(sq) {
	__deedDecorateOwnerInfo(sq);
	// Render the owner row inside the special variant by mirroring DOM:
	// the special view doesn't have a deed-owner-row of its own, so we re-use
	// the deed-special-text block by prepending a small line when owned.
	var textEl = document.getElementById('deed-special-text');
	if (!textEl || sq.owner === 0) return;
	var ownerPlayer = player[sq.owner];
	if (!ownerPlayer) return;
	var ownerLabel = (typeof t === 'function' ? t('deed.ownerLabel') : 'Owner');
	var dotStyle = 'background:' + ownerPlayer.color + ';';
	var prefix = '<div class="deed-owner-line deed-owner-line-inline">' +
		'<span class="deed-owner-dot" style="' + dotStyle + '"></span>' +
		'<span class="deed-owner-label">' + ownerLabel + ':</span>' +
		'<strong class="deed-owner-name">' + ownerPlayer.name + '</strong>' +
		'</div>';
	textEl.innerHTML = prefix + textEl.innerHTML;
}

function showdeed(property) {
	var sq = square[property];
	UI.$show("deed");

	UI.$hide("deed-normal");
	UI.$hide("deed-mortgaged");
	UI.$hide("deed-special");

	if (sq.mortgage) {
		UI.$show("deed-mortgaged");
		document.getElementById("deed-mortgaged-name").textContent = sq.name;
		document.getElementById("deed-mortgaged-mortgage").textContent = (sq.price / 2);

	} else {

		if (sq.groupNumber >= 3) {
			UI.$show("deed-normal");
			document.getElementById("deed-header").style.backgroundColor = sq.color;
			document.getElementById("deed-name").textContent = sq.name;
			document.getElementById("deed-price").textContent = sq.price;
			document.getElementById("deed-baserent").textContent = sq.baserent;
			document.getElementById("deed-rent1").textContent = sq.rent1;
			document.getElementById("deed-rent2").textContent = sq.rent2;
			document.getElementById("deed-rent3").textContent = sq.rent3;
			document.getElementById("deed-rent4").textContent = sq.rent4;
			document.getElementById("deed-rent5").textContent = sq.rent5;
			document.getElementById("deed-mortgage").textContent = (sq.price / 2);
			document.getElementById("deed-houseprice").textContent = sq.houseprice;
			document.getElementById("deed-hotelprice").textContent = sq.houseprice;

			// Owner indicator + group ownership progress.
			__deedDecorateOwnerInfo(sq);
			// Highlight whichever rent row reflects the property's current state.
			__deedHighlightCurrentRent(sq);

		} else if (sq.groupNumber == 2) {
			UI.$show("deed-special");
			document.getElementById("deed-special-name").textContent = sq.name;
			document.getElementById("deed-special-price-amount").textContent = sq.price;
			document.getElementById("deed-special-text").innerHTML = utiltext();
			document.getElementById("deed-special-mortgage").textContent = (sq.price / 2);
			__deedDecorateSpecial(sq);

		} else if (sq.groupNumber == 1) {
			UI.$show("deed-special");
			document.getElementById("deed-special-name").textContent = sq.name;
			document.getElementById("deed-special-price-amount").textContent = sq.price;
			document.getElementById("deed-special-text").innerHTML = transtext();
			document.getElementById("deed-special-mortgage").textContent = (sq.price / 2);
			__deedDecorateSpecial(sq);
		}
	}
}

function hidedeed() {
	UI.$hide("deed");
}

function buy() {
	var p = player[turn];
	var property = square[p.position];
	// Defensive: skip when there's nothing buyable (corner, tax, etc.) or
	// the property already has an owner (would happen if buy() is called
	// twice in quick succession before the UI hides the button).
	if (!property || property.price === 0 || property.owner !== 0) return;
	var cost = property.price;

	if (p.money >= cost) {
		p.pay(cost, 0);

		property.owner = turn;
		updateMoney();
		addAlert(t('alert.boughtProperty', { player: p.name, place: property.name, price: property.price }));
		if (typeof UI !== 'undefined') UI.toast(t('alert.boughtProperty', { player: p.name, place: property.name, price: property.price }), { kind: 'success' });
		if (typeof Sound !== 'undefined') Sound.coin();
		// Sprint 1 (S1.4b) — celebratory triple-tap haptic on successful buy.
		if (typeof __haptic === 'function') __haptic([15, 30, 15]);

		__pulsePurchasedCell(p.position, p.color);

		// Sprint 3 (S3.2) — burst confetti if this purchase closed a color
		// monopoly. property.color is the group swatch color; pad with the
		// gold + white accent palette for visual variety.
		if (__completesColorGroupNow(property, turn)) {
			var cellEl = document.getElementById('cell' + p.position);
			if (cellEl && typeof __burstConfetti === 'function') {
				__burstConfetti(cellEl, [property.color || '#1B5E3F', '#FFD24A', '#FFFFFF']);
			}
		}

		updateOwned();

		UI.$hide("landed");

	} else {
		popup("<p>" + t('popup.needForHouse', { amount: (property.price - p.money), place: property.name }) + "</p>");
	}
	// Decision was taken (success OR not-enough-cash) — release the roll gate.
	window.GameState.pendingBuyDecision = false;
}

function mortgage(index) {
	var sq = square[index];
	if (!sq || sq.owner === 0) return false;
	var p = player[sq.owner];

	if (sq.house > 0 || sq.hotel > 0 || sq.mortgage) {
		return false;
	}
	// Real-Monopoly rule: to mortgage ANY property in a color group, the
	// entire group must have zero houses/hotels. (UI gates this too, but
	// defensive — AI must also respect it.)
	if (sq.group) {
		for (var gi = 0; gi < sq.group.length; gi++) {
			var gs = square[sq.group[gi]];
			if (gs.house > 0 || gs.hotel > 0) return false;
		}
	}

	var mortgagePrice = Math.round(sq.price * 0.5);
	var unmortgagePrice = Math.round(sq.price * 0.55);

	sq.mortgage = true;
	p.money += mortgagePrice;

	document.getElementById("mortgagebutton").value = t('ui.mortgage') + " ($" + unmortgagePrice + ")";
	document.getElementById("mortgagebutton").title = t('popup.unmortgageConfirm', { player: p.name, place: sq.name, amount: unmortgagePrice });

	addAlert(t('alert.mortgaged', { player: p.name, place: sq.name, amount: mortgagePrice }));
	__updateMortgagedVisual(index);
	updateOwned();
	updateMoney();

	return true;
}

function unmortgage(index) {
	var sq = square[index];
	var p = player[sq.owner];
	var unmortgagePrice = Math.round(sq.price * 0.55);
	var mortgagePrice = Math.round(sq.price * 0.5);

	if (unmortgagePrice > p.money || !sq.mortgage) {
		return false;
	}

	p.pay(unmortgagePrice, 0);
	sq.mortgage = false;
	document.getElementById("mortgagebutton").value = t('ui.mortgage') + " ($" + mortgagePrice + ")";
	document.getElementById("mortgagebutton").title = t('popup.mortgageConfirm', { player: p.name, place: sq.name, amount: mortgagePrice });

	addAlert(t('alert.unmortgaged', { player: p.name, place: sq.name, amount: unmortgagePrice }));
	__updateMortgagedVisual(index);
	updateOwned();
	return true;
}


function land(increasedRent) {
	increasedRent = !!increasedRent; // Cast increasedRent to a boolean value. It is used for the ADVANCE TO THE NEAREST RAILROAD/UTILITY Chance cards.

	var p = player[turn];
	var s = square[p.position];

	var die1 = game.getDie(1);
	var die2 = game.getDie(2);

	UI.$show("landed");
	document.getElementById("landed").innerHTML = t('landed.youLandedOn', { place: s.name });
	s.landcount++;
	addAlert(t('alert.landedOn', { player: p.name, place: s.name }));

	// Allow player to buy the property on which he landed.
	if (s.price !== 0 && s.owner === 0) {
		if (!p.human) {
			// AI decides synchronously — no popup, so no need to gate
			// roll()/next() with __pendingBuyDecision. Setting the flag here
			// would leak if the AI declines to buy (no buy()/auction call to
			// clear it).
			if (p.AI.buyProperty(p.position)) {
				buy();
			}
		} else {
			// Block Roll-Again / End-Turn until the human picks buy or auction.
			window.GameState.pendingBuyDecision = true;
			var noAuc = !!(window.GameConfig.houseRules && window.GameConfig.houseRules.noAuctions);
			var auctionBtnHtml = noAuc ? '' :
				"<input type='button' id='auctionbtn-landed' onclick='__startAuctionFromLanded();' value='" + t('ui.auctionNow') + "' title='" + t('ui.auctionNowTitle') + "'/>";
			var hintHtml = noAuc
				? "<div class='landed-hint'>" + t('landed.noAuctionHint') + "</div>"
				: "<div class='landed-hint'>" + t('landed.buyOrAuctionHint') + "</div>";
			var deedLinkHtml = "<a href='javascript:void(0);' onmouseover='showdeed(" + p.position + ");' onmouseout='hidedeed();' class='statscellcolor'>" + I18N.escape(s.name) + "</a>";
			var landedSentence = t('landed.youLandedOn', { place: 'PLACE' }).split('PLACE').join(deedLinkHtml);
			document.getElementById("landed").innerHTML =
				"<div>" +
					landedSentence +
					"<input type='button' id='buybtn-landed' class='primary-buy' data-buy-cost='" + s.price + "' onclick='buy();' onmouseenter='__previewBuyConsequence(this, " + s.price + ")' onmouseleave='__hideConsequencePreview()' value='" + t('ui.buyFor', { price: s.price }) + "' title='" + t('ui.buyTitle', { place: s.name, pricetext: s.pricetext }) + "'/>" +
					auctionBtnHtml +
					hintHtml +
				"</div>";
		}


		// House rule: no auctions — unbought property simply returns to bank.
		if (!(window.GameConfig.houseRules && window.GameConfig.houseRules.noAuctions)) {
			game.addPropertyToAuctionQueue(p.position);
		}
	}

	// Collect rent
	if (s.owner !== 0 && s.owner != turn && !s.mortgage) {
		var groupowned = true;
		var rent;

		// Railroads
		if (p.position == 5 || p.position == 15 || p.position == 25 || p.position == 35) {
			if (increasedRent) {
				rent = 25;
			} else {
				rent = 12.5;
			}

			if (s.owner == square[5].owner) {
				rent *= 2;
			}
			if (s.owner == square[15].owner) {
				rent *= 2;
			}
			if (s.owner == square[25].owner) {
				rent *= 2;
			}
			if (s.owner == square[35].owner) {
				rent *= 2;
			}

		} else if (p.position === 12) {
			if (increasedRent || square[28].owner == s.owner) {
				rent = (die1 + die2) * 10;
			} else {
				rent = (die1 + die2) * 4;
			}

		} else if (p.position === 28) {
			if (increasedRent || square[12].owner == s.owner) {
				rent = (die1 + die2) * 10;
			} else {
				rent = (die1 + die2) * 4;
			}

		} else {

			for (var i = 0; i < 40; i++) {
				sq = square[i];
				if (sq.groupNumber == s.groupNumber && sq.owner != s.owner) {
					groupowned = false;
				}
			}

			if (!groupowned) {
				rent = s.baserent;
			} else {
				if (s.house === 0) {
					rent = s.baserent * 2;
				} else {
					rent = s["rent" + s.house];
				}
			}
		}

		addAlert(t('alert.paidRent', { player: p.name, amount: rent, owner: player[s.owner].name }));
		if (typeof UI !== 'undefined') {
			UI.toast(t('alert.paidRent', { player: p.name, amount: rent, owner: player[s.owner].name }), { kind: 'warning' });
		}
		p.pay(rent, s.owner);
		player[s.owner].money += rent;

		// Sprint 1 (S1.4c) — heavier haptic when rent comes out of your pocket.
		if (typeof __haptic === 'function') __haptic([100]);

		// Sprint 2 (S2.2c / S2.2d) — fat-rent screen-shake. The shake is a
		// screen-wide effect, so the "payer" vs "receiver" perspective only
		// matters for which player is the active human at the table. Pick the
		// stronger magnitude when the active player is paying the rent (they
		// see their cash drain), and the gentler one when they're collecting.
		// The two cases are mutually exclusive because s.owner != turn is
		// guaranteed above by the surrounding `if`.
		if (rent > 500 && typeof __shake === 'function') {
			if (player[turn].human) {
				__shake(4, 300); // S2.2c — you just paid > $500
			} else if (player[s.owner].human) {
				__shake(3, 250); // S2.2d — you just received > $500
			} else {
				// Both AI: still shake gently so spectators see the moment.
				__shake(3, 250);
			}
		}
		// Sprint 2 (S2.3b) — camera zoom-pulse when the active player lands
		// on a rival property with rent ≥ $200.
		if (rent >= 200 && typeof __zoomPulse === 'function') {
			__zoomPulse(1.04, 700);
		}

		// Visual: animate a "$X" symbol arcing from the payer's token to
		// the owner's money-bar row so the cash transfer is visible.
		__animateRentFlight(turn, s.owner, rent);

		document.getElementById("landed").innerHTML = t('landed.youLandedRent', { place: s.name, owner: player[s.owner].name, amount: rent });
	} else if (s.owner > 0 && s.owner != turn && s.mortgage) {
		document.getElementById("landed").innerHTML = t('landed.youLandedMortgaged', { place: s.name });
	}

	// City Tax
	if (p.position === 4) {
		citytax();
	}

	// House rule: collect the Free Parking jackpot when landing on cell 20.
	if (p.position === 20 && typeof __collectFPPot === 'function') {
		__collectFPPot(p);
	}

	// Go to jail. Go directly to Jail. Do not pass GO. Do not collect $200.
	if (p.position === 30) {
		updateMoney();
		updatePosition();

		if (p.human) {
			popup("<div>" + t('popup.gotoJailMsg') + "</div>", gotojail);
		} else {
			gotojail();
		}

		return;
	}

	// Luxury Tax
	if (p.position === 38) {
		luxurytax();
	}

	updateMoney();
	updatePosition();
	updateOwned();

	if (!p.human) {
		__showAIRecapToast(p);
		p.AI.alertList = "";
		chanceCommunityChest();
	} else {
		chanceCommunityChest();
	}
}

// House rule: $500 bonus for snake-eyes (double 1s). No-op unless the rule
// is toggled in setup. Kept separate so the main roll flow stays readable.
function _applySnakeEyesBonus(p) {
	if (!(window.GameConfig.houseRules && window.GameConfig.houseRules.snakeEyesBonus)) return;
	p.money += 500;
	addAlert(t('alert.snakeEyes', { player: p.name }));
	if (typeof UI !== 'undefined') UI.toast(t('alert.snakeEyes', { player: p.name }), { kind: 'success' });
	if (typeof Sound !== 'undefined' && Sound.coin) Sound.coin();
}

// Walk to (cellIndex + diceSum) % 40 from cell 10 (Jail) and then land().
// Shared by the three jail-exit paths so they stay consistent.
function _exitJailAndWalkTo(p, die1, die2) {
	p.position = 10 + die1 + die2;
	if (typeof __walkPlayerSteps === 'function') {
		__walkPlayerSteps(turn, 10, die1 + die2, function () { land(); });
	} else {
		land();
	}
}

// Player is in jail when roll() reaches this branch. Three sub-outcomes:
//   - rolled doubles → free, walk out
//   - third failed roll → must pay $50, then walk out
//   - otherwise → stay in jail this turn
function _handleJailTurn(p, die1, die2) {
	p.jailroll++;
	updateDice();

	if (die1 == die2) {
		document.getElementById("jail").style.border = "1px solid black";
		document.getElementById("cell11").style.border = "2px solid " + p.color;
		UI.$hide("landed");

		p.jail = false;
		p.jailroll = 0;
		doublecount = 0;
		addAlert(t('alert.doublesOutOfJail', { player: p.name }));
		_exitJailAndWalkTo(p, die1, die2);
		return;
	}

	if (p.jailroll === 3) {
		if (p.human) {
			popup("<p>" + t('popup.payFineMsg') + "</p>", function () {
				payfifty();
				_exitJailAndWalkTo(player[turn], die1, die2);
			});
		} else {
			payfifty();
			_exitJailAndWalkTo(p, die1, die2);
		}
		return;
	}

	UI.$show("landed");
	document.getElementById("landed").innerHTML = t('landed.inJail');
	if (!p.human) {
		__showAIRecapToast(p);
		p.AI.alertList = "";
		game.next();
	}
}

// Normal non-jail movement: advance, pay GO salary if wrapped, walk.
function _handleNormalMove(p, die1, die2) {
	// Doubles path already tumbled the dice in roll(); skip to avoid a second tumble/sound.
	if (die1 !== die2) updateDice();

	var startPos = p.position;
	var moveAmount = die1 + die2;
	p.position += moveAmount;

	// House rule: Double GO pays $400 if you LAND EXACTLY on GO (p.position === 40).
	if (p.position >= 40) {
		var landedExactlyOnGo = (p.position === 40);
		p.position -= 40;
		var salary = (landedExactlyOnGo && window.GameConfig.houseRules && window.GameConfig.houseRules.doubleGo) ? 400 : 200;
		p.money += salary;
		var key = (salary === 400) ? 'alert.doubleGo' : 'alert.collectedSalary';
		addAlert(t(key, { player: p.name }));
		if (typeof UI !== 'undefined') UI.toast(t(key, { player: p.name }), { kind: 'success' });
	}

	if (typeof __walkPlayerSteps === 'function') {
		__walkPlayerSteps(turn, startPos, moveAmount, function () { land(); });
	} else {
		land();
	}
}

function roll() {
	// Belt-and-suspenders re-entry guard. game.next() already refuses when
	// __walking is true, but roll() is also reachable from popup callbacks
	// (jail-exit, doubles) and from AI flows. A second roll while the walk
	// timer chain is still firing would read a stale p.position and animate
	// from the wrong startPos — that's exactly the "token moved too few /
	// too many cells" bug the player saw. Bail out and let the in-flight
	// walk finish; the next roll will be picked up by the normal button.
	if (window.GameState.walking) return;
	if (window.GameState.pendingBuyDecision) return;
	var p = player[turn];

	UI.$hide("option");
	UI.$show("buy");
	UI.$hide("manage");

	if (p.human) document.getElementById("nextbutton").focus();
	document.getElementById("nextbutton").value = t('ui.endTurn');
	document.getElementById("nextbutton").title = t('ui.endTurnTitle');

	// Skip the actual rollDice call if the dice were just thrown by the
	// user — the throw handler (flingPair) already called rollDice and
	// the cubes are already showing the rolled faces.
	if (!window.GameState.skipNextUpdateDice) game.rollDice();
	if (typeof __setRollPulse === 'function') __setRollPulse(false);

	var die1 = game.getDie(1);
	var die2 = game.getDie(2);
	doublecount++;

	if (die1 == die2) {
		addAlert(t('alert.rolledDoubles', { player: p.name, n: die1 + die2 }));
		if (die1 === 1) _applySnakeEyesBonus(p);
		// Sprint 2 (S2.3a) — subtle camera punch-in on any doubles.
		if (typeof __zoomPulse === 'function') __zoomPulse(1.025, 600);
	} else {
		addAlert(t('alert.rolled', { player: p.name, n: die1 + die2 }));
	}

	if (die1 == die2 && !p.jail) {
		updateDice();
		if (doublecount < 3) {
			document.getElementById("nextbutton").value = t('ui.rollAgain');
			document.getElementById("nextbutton").title = t('ui.rollAgainTitle');
		} else {
			// Three doubles in a row → off to jail.
			p.jail = true;
			doublecount = 0;
			addAlert(t('alert.tripleDoubles', { player: p.name }));
			updateMoney();
			// Sprint 2 (S2.2a) — sharp screen-shake to mark the bust.
			if (typeof __shake === 'function') __shake(6, 400);
			if (p.human) popup(t('popup.tripleDoublesMsg'), gotojail, undefined, { autoMs: 6000 });
			else gotojail();
			return;
		}
	} else {
		document.getElementById("nextbutton").value = t('ui.endTurn');
		document.getElementById("nextbutton").title = t('ui.endTurnTitle');
		doublecount = 0;
	}

	updatePosition();
	updateMoney();
	updateOwned();

	if (p.jail === true) {
		_handleJailTurn(p, die1, die2);
	} else {
		_handleNormalMove(p, die1, die2);
	}
}

function play() {
	if (game.auction()) {
		return;
	}

	turn++;
	if (turn > pcount) {
		turn = 1;
	}

	var p = player[turn];
	game.resetDice();

	// Sprint 1 (S1.2) — persistent turn indicator. Mark the active player's
	// row in the sidepanel-left moneybar with a glow keyed to their color.
	// We expose --player-color inline so each row pulses in its own hue.
	var __mbRows = document.querySelectorAll('.money-bar-row');
	for (var __mi = 0; __mi < __mbRows.length; __mi++) {
		__mbRows[__mi].classList.remove('is-active-turn');
		__mbRows[__mi].style.removeProperty('--player-color');
	}
	var __activeRow = document.getElementById('moneybarrow' + turn);
	if (__activeRow) {
		__activeRow.style.setProperty('--player-color', p.color);
		__activeRow.classList.add('is-active-turn');
	}

	var __pnameEl = document.getElementById("pname");
	__pnameEl.textContent = p.name;
	// Long AI names (e.g. "Dolores Fuertes de Barriga") trigger ellipsis via
	// .qs-name-row CSS; expose the full text on hover for sighted users.
	__pnameEl.title = p.name;

	addAlert(t('alert.isYourTurn', { player: p.name }));
	// Slide-in banner so the active player is immediately obvious.
	if (typeof __showTurnBanner === 'function') __showTurnBanner(p);
	// Brief board-border flash in the new player's color.
	if (typeof __flashBoardTurn === 'function') __flashBoardTurn(p.color);
	// Pulse Roll Dice while we're waiting on a human to roll; turn it off
	// for AI turns (the AI rolls automatically, no need to draw attention).
	// Sprint 1 (S1.3) — tint the pulse halo with the active player's color
	// so the visual reinforcement matches their identity. We stash the color
	// + flag on the button BEFORE turning the pulse on, so the CSS variant
	// rule (.btn-pulse-attn[data-pulse-color]) applies on the first frame.
	var __nextBtn = document.getElementById('nextbutton');
	if (__nextBtn) {
		if (p.human) {
			__nextBtn.style.setProperty('--pulse-color', p.color);
			__nextBtn.setAttribute('data-pulse-color', '1');
		} else {
			__nextBtn.removeAttribute('data-pulse-color');
			__nextBtn.style.removeProperty('--pulse-color');
		}
	}
	if (typeof __setRollPulse === 'function') __setRollPulse(p.human);
	// Body-level flag: gates the avatar "thinking" ring (human turn) and
	// the AI-turn lock CSS that disables gameplay interactions.
	document.body.setAttribute('data-await', p.human ? 'human' : 'ai');
	// The CSS lock overlay reads its label from data-ai-label on #sp-control.
	var spControl = document.getElementById('sp-control');
	if (spControl) {
		var label = (typeof t === 'function')
			? t('panel.aiThinking', { player: p.name })
			: p.name + ' is thinking…';
		spControl.setAttribute('data-ai-label', label);
	}

	// Check for bankruptcy.
	p.pay(0, p.creditor);

	UI.$hide("landed"); UI.$hide("option"); UI.$hide("manage");
	UI.$show("board"); UI.$show("control"); UI.$show("moneybar"); UI.$show("viewstats"); UI.$show("buy");

	doublecount = 0;
	if (p.human) {
		document.getElementById("nextbutton").focus();
	}
	document.getElementById("nextbutton").value = t('ui.rollDice');
	document.getElementById("nextbutton").title = t('ui.rollDiceTitle');

	// Dice stay visible at the start of every turn so the player can either
	// click "Tirar dados" OR grab and throw them physically. They sit on a
	// neutral face (1) until rolled — __tumbleDie tumbles to the rolled face
	// when updateDice runs.
	UI.$show("die0");
	UI.$show("die1");

	// Arm the auto-roll timer for HUMAN turns. AI flows trigger their own
	// rolls, so we skip them. Any prior timer is wiped first (paranoid: a
	// stale timer from a previous turn would fire on the wrong player).
	if (p.human && typeof __armAutoRoll === 'function') __armAutoRoll();
	else if (typeof __cancelAutoRoll === 'function') __cancelAutoRoll();

	if (p.jail) {
		UI.$show("landed");
		document.getElementById("landed").innerHTML = t('landed.inJail') + "<input type='button' title='" + t('ui.payFineTitle') + "' value='" + t('ui.payFineButton') + "' onclick='payfifty();' />";

		if (p.communityChestJailCard || p.chanceJailCard) {
			document.getElementById("landed").innerHTML += "<input type='button' id='gojfbutton' title='" + t('ui.useCardTitle') + "' onclick='useJailCard();' value='" + t('ui.useCard') + "' />";
		}

		document.getElementById("nextbutton").title = t('ui.rollDiceTitle');

		if (p.jailroll === 0)
			addAlert(t('alert.firstTurnInJail', { player: p.name }));
		else if (p.jailroll === 1)
			addAlert(t('alert.secondTurnInJail', { player: p.name }));
		else if (p.jailroll === 2) {
			document.getElementById("landed").innerHTML += "<div>NOTE: If you do not throw doubles after this roll, you <i>must</i> pay the $50 fine.</div>";
			addAlert(t('alert.thirdTurnInJail', { player: p.name }));
		}

		if (!p.human && p.AI.postBail()) {
			if (p.communityChestJailCard || p.chanceJailCard) {
				useJailCard();
			} else {
				payfifty();
			}
		}
	}

	updateMoney();
	updatePosition();
	updateOwned();

	var __mbArrows = document.querySelectorAll(".money-bar-arrow");
	for (var __mi = 0; __mi < __mbArrows.length; __mi++) __mbArrows[__mi].style.display = "none";
	var __turnArrow = document.getElementById("p" + turn + "arrow");
	if (__turnArrow) __turnArrow.style.display = "";

	if (!p.human) {
		if (!p.AI.beforeTurn()) {
			game.next();
		}
	}
}

function setup() {
	pcount = parseInt(document.getElementById("playernumber").value, 10);

	// Reset game state
	turn = 0;
	doublecount = 0;

	// Start background music matching the chosen edition. Deferred via
	// rAF + idle callback so the board's first paint isn't competing with
	// the MP3 decode (which used to look like the board "restarted"
	// briefly when the edition changed). The user click + the setup
	// screen's preloadMusicForEdition both already unlocked the audio
	// context and started buffering; this just hands play() control to
	// the next idle frame.
	if (typeof Sound !== 'undefined' && Sound.playMusicForEdition) {
		var __startMusic = function () {
			try { Sound.playMusicForEdition(window.GameConfig && window.GameConfig.edition); } catch (e) {}
		};
		if (window.requestIdleCallback) {
			requestAnimationFrame(function () { requestIdleCallback(__startMusic, { timeout: 1200 }); });
		} else {
			setTimeout(__startMusic, 250);
		}
	}

	// ----- House rules: read toggles, expose globally for game logic -----
	function __readHouseRule(id) {
		var el = document.getElementById(id);
		return !!(el && el.checked);
	}
	window.GameConfig.houseRules = {
		freeParkingJackpot: __readHouseRule('rule-free-parking-jackpot'),
		snakeEyesBonus:     __readHouseRule('rule-snake-eyes-bonus'),
		doubleGo:           __readHouseRule('rule-double-go'),
		noAuctions:         __readHouseRule('rule-no-auctions'),
		speedMode:          __readHouseRule('rule-speed-mode')
	};
	window.GameState.freeParkingPot = 0;
	// Apply speed-mode class to body so CSS animations + transitions scale.
	if (window.GameConfig.houseRules.speedMode) document.body.classList.add('speed-mode');
	else document.body.classList.remove('speed-mode');

	// Reset board properties. NOTE: the model uses singular `house`/`hotel`
	// (set by the Square constructor). The original code wrote `houses`/`hotels`
	// which created phantom properties and left the real ones intact between games.
	for (var i = 0; i < 40; i++) {
		square[i].owner = 0;
		square[i].mortgage = false;
		square[i].house = 0;
		square[i].hotel = 0;
		// Wipe any leftover visual state on the cells.
		if (typeof __updateBuildings === 'function')       __updateBuildings(i);
		if (typeof __updateMortgagedVisual === 'function') __updateMortgagedVisual(i);
	}
	// Clear any stale Free Parking pot badge from a previous game.
	var oldPot = document.getElementById('fp-pot-badge');
	if (oldPot && oldPot.parentNode) oldPot.parentNode.removeChild(oldPot);

	// Reset i18n-tracked deltas so the first updateMoney of a new game doesn't pulse.
	__prevMoney = {};

	// Reset AI counters so each game's AI players are numbered from 1.
	if (typeof AIEasy     !== 'undefined') AIEasy.count     = 0;
	if (typeof AINormal   !== 'undefined') AINormal.count   = 0;
	if (typeof AIHard     !== 'undefined') AIHard.count     = 0;
	if (typeof AIAdaptive !== 'undefined') AIAdaptive.count = 0;

	// Reshuffle Chance and Community Chest decks for a fresh game.
	if (typeof chanceCards !== 'undefined' && chanceCards.deck) {
		chanceCards.deck = [];
		communityChestCards.deck = [];
		for (var i = 0; i < 16; i++) {
			chanceCards.deck[i] = i;
			communityChestCards.deck[i] = i;
		}
		__shuffle(chanceCards.deck);
		__shuffle(communityChestCards.deck);
		chanceCards.index = 0;
		communityChestCards.index = 0;
	}

	for (var i = 1; i <= pcount; i++) {
		var p = player[i];
		p.index = i;

		p.color = document.getElementById("player" + i + "color").value.toLowerCase();
		var avEl = document.getElementById('player' + i + 'avatar');
		p.avatar = avEl ? avEl.value : '';

		var aiLevel = document.getElementById("player" + i + "ai").value;
		if (aiLevel === "0") {
			p.name = document.getElementById("player" + i + "name").value;
			p.human = true;
			p.AI = null;
		} else {
			p.human = false;
			if (aiLevel === "1")      p.AI = new AIEasy(p);
			else if (aiLevel === "3") p.AI = new AIHard(p);
			else if (aiLevel === "4") p.AI = new AIAdaptive(p);
			else                      p.AI = new AINormal(p);   // default for "2" and legacy
		}
		// Initialize player state
		p.position = 0;
		p.money = (typeof window.GameConfig.startingCash === 'number') ? window.GameConfig.startingCash : 1500;
		p.jail = false;
		p.jailroll = 0;
		p.creditor = -1;
		p.communityChestJailCard = false;
		p.chanceJailCard = false;
		p.bidding = true;
	}

	// Persist setup form values for next session — names, colors, AI choices,
	// player count, starting cash preset AND house rules. Restored at
	// window.onload.
	try {
		var snapshot = { pcount: pcount, players: {}, cash: window.GameConfig.startingCash || 1500 };
		for (var ps = 1; ps <= 8; ps++) {
			var nameEl = document.getElementById('player' + ps + 'name');
			var colorEl = document.getElementById('player' + ps + 'color');
			var aiEl = document.getElementById('player' + ps + 'ai');
			var avEl2 = document.getElementById('player' + ps + 'avatar');
			snapshot.players[ps] = {
				name:   nameEl  ? nameEl.value  : '',
				color:  colorEl ? colorEl.value : '',
				ai:     aiEl    ? aiEl.value    : '0',
				avatar: avEl2   ? avEl2.value   : ''
			};
		}
		snapshot.rules = window.GameConfig.houseRules || {};
		window.localStorage.setItem('monopoly:setup', JSON.stringify(snapshot));
	} catch (e) { /* storage unavailable — non-fatal */ }

	UI.$show("board"); UI.$show("moneybar");
	UI.$hide("setup");
	// Game has started — reveal the players/control sections of the side panel.
	document.body.setAttribute('data-phase', 'play');

	// Lazy-load the wood-grain body texture (~757KB) now that the game stage
	// is visible. CSS body::after fades it in via opacity once decoded, so
	// the initial paint stays fast and the swap is imperceptible behind the
	// intro animation. Falls back to solid surface color on slow networks.
	if (typeof UI !== 'undefined' && typeof UI.loadWoodTexture === 'function') {
		UI.loadWoodTexture();
	}

	// Board is now laid out; safe to measure cell positions and create the
	// 8 persistent tokens used by updatePosition (approach B, sliding).
	__initTokenLayer();

	// Cinematic intro — runs once per game. Sets each token's __pendingDrop
	// flag so the first __placeTokenInCell call uses the drop-in keyframe.
	if (typeof __playGameIntro === 'function') __playGameIntro();

	// First-time onboarding tour. No-op for returning players (localStorage flag).
	if (typeof window.__startTour === 'function') window.__startTour();

	if (pcount === 2) {
		document.getElementById("stats").style.width = "454px";
	} else if (pcount === 3) {
		document.getElementById("stats").style.width = "686px";
	}

	document.getElementById("stats").style.top = "0px";
	document.getElementById("stats").style.left = "0px";

	play();
}

function getCheckedProperty() {
	for (var i = 0; i < 42; i++) {
		if (document.getElementById("propertycheckbox" + i) && document.getElementById("propertycheckbox" + i).checked) {
			return i;
		}
	}
	return -1; // No property is checked.
}

// function propertycell_onclick(element, num) {
	// togglecheck("propertycheckbox" + num);
	// if (document.getElementById("propertycheckbox" + num).checked) {

		// // Uncheck all other boxes.
		// for (var i = 0; i < 40; i++) {
			// if (i !== num && document.getElementById("propertycheckbox" + i)) {
				// document.getElementById("propertycheckbox" + i).checked = false;
			// }
		// }
	// }

	// updateOption();
// }

function playernumber_onchange() {
	pcount = parseInt(document.getElementById("playernumber").value, 10);

	var __piRows = document.querySelectorAll(".player-input");
	for (var __pi = 0; __pi < __piRows.length; __pi++) __piRows[__pi].style.display = "none";

	for (var i = 1; i <= pcount; i++) {
		UI.$show("player" + i + "input");
	}
}

function menuitem_onmouseover(element) {
	element.className = "menuitem menuitem_hover";
	return;
}

function menuitem_onmouseout(element) {
	element.className = "menuitem";
	return;
}

// Fit the fixed-design-size #game-stage to the viewport.
// Rotates 90deg on portrait so the game always renders landscape.
// Exposes the active transform so drag handlers can invert it.
function fitStage() {
	var stage = document.getElementById('game-stage');
	if (!stage) return;
	var vw = window.innerWidth;
	var vh = window.innerHeight;
	// MUST match the width/height declared on #game-stage in styles.css.
	// Aspect 1.94:1 — deliberately wider than the 16:9 viewport so the
	// scale calculation below is ALWAYS width-bound. Result: the stage
	// fills ~95 % of the viewport horizontally and uses 87-92 % of the
	// height, instead of leaving a wide horizontal margin of empty wood.
	var sw = 1820, sh = 940;
	// Viewport gutter ~12 px on a 1080p screen.
	var marginPx = Math.max(8, Math.round(Math.min(vw, vh) * 0.012));
	var portrait = vh > vw;
	var scale, rotateDeg, cos, sin;
	if (portrait) {
		scale = Math.min((vh - marginPx * 2) / sw, (vw - marginPx * 2) / sh);
		rotateDeg = 90;
		cos = 0; sin = 1;
	} else {
		scale = Math.min((vw - marginPx * 2) / sw, (vh - marginPx * 2) / sh);
		rotateDeg = 0;
		cos = 1; sin = 0;
	}
	// Clamp scale for extreme viewports:
	//  - Below 0.18: text on the board becomes illegible (~280px-wide fold
	//    devices, heavily-zoomed-out users). Lock the board to a readable
	//    minimum and accept the overflow — the user can scroll.
	//  - Above 1.5: on 4K+ monitors the stage would dominate the screen and
	//    crowd out the sidepanels. Cap so the sidepanels keep breathing room.
	if (scale < 0.18) scale = 0.18;
	if (scale > 1.5)  scale = 1.5;
	// translate(-50%,-50%) keeps the stage centered before scale/rotate.
	// Sprint 2 (S2.2/S2.3) — instead of writing transform directly, expose
	// the base transform via a CSS custom property so the shake / zoom
	// effects can compose with it (see #game-stage rule in styles.css).
	// Writing to .style.transform here would clobber the composed transform
	// the moment fitStage() ran (resize / orientationchange), so we route
	// EVERYTHING through --stage-transform.
	var baseTransform = 'translate(-50%, -50%) rotate(' + rotateDeg + 'deg) scale(' + scale + ')';
	stage.style.setProperty('--stage-transform', baseTransform);
	// Clear any direct transform left over from earlier builds, otherwise
	// the inline `transform: translate(-50%,-50%)` from styles.css can win
	// in cascade and the composed transform never applies.
	stage.style.transform = '';
	window.GameState.stageTx = { scale: scale, rotation: rotateDeg, cos: cos, sin: sin };
}

// Render the 8 player-setup blocks into #player-setup-list. The IDs match
// what monopoly.js reads at start time (player{N}name/color/ai/input). Must
// run BEFORE I18N.applyToDOM() so the data-i18n attributes get translated.
function __renderPlayerSetup() {
	var host = document.getElementById('player-setup-list');
	if (!host || host.childElementCount > 0) return;
	var COLORS = ['Aqua','Black','Blue','Fuchsia','Gray','Green','Lime','Maroon','Navy','Olive','Orange','Purple','Red','Silver','Teal','Yellow'];
	var DEFAULT_COLOR = { 1:'Yellow', 2:'Blue', 3:'Red', 4:'Lime', 5:'Green', 6:'Aqua', 7:'Orange', 8:'Purple' };
	var html = '';
	for (var n = 1; n <= 8; n++) {
		var labelId = 'player' + n + 'label';
		html += '<div id="player' + n + 'input" class="player-input" role="group" aria-labelledby="' + labelId + '">';
		html += '<label class="player-label" id="' + labelId + '" for="player' + n + 'name" data-player-num="' + n + '">Player ' + n + ':</label> ';
		html += '<input type="text" id="player' + n + 'name" data-i18n-title="setup.playerName" title="Player name" maxlength="16" value="Player ' + n + '" /> ';
		html += '<select id="player' + n + 'color" data-i18n-title="setup.playerColor" data-i18n-aria="setup.playerColor" title="Player color" aria-label="Player color">';
		for (var c = 0; c < COLORS.length; c++) {
			var col = COLORS[c];
			var sel = (DEFAULT_COLOR[n] === col) ? ' selected="selected"' : '';
			html += '<option style="color: ' + col.toLowerCase() + ';"' + sel + '>' + col + '</option>';
		}
		html += '</select> ';
		html += '<select id="player' + n + 'ai" class="player-ai-select" data-i18n-title="setup.playerAi" data-i18n-aria="setup.playerAi" title="Choose whether this player is controlled by a human or by the computer." aria-label="Player type" data-player-ai-for="' + n + '">';
		html += '<option value="0" selected="selected" data-i18n="setup.human">Human</option>';
		html += '<option value="1" data-i18n="setup.aiEasy">AI (Easy)</option>';
		html += '<option value="2" data-i18n="setup.aiNormal">AI (Normal)</option>';
		html += '<option value="3" data-i18n="setup.aiHard">AI (Hard)</option>';
		html += '<option value="4" data-i18n="setup.aiAdaptive">AI (Adaptive)</option>';
		html += '</select>';
		html += '</div>';
	}
	host.innerHTML = html;
	// Delegated handler: disable the name input when the player is AI.
	host.addEventListener('change', function (e) {
		var t = e.target;
		var n = t.getAttribute && t.getAttribute('data-player-ai-for');
		if (!n) return;
		var nameEl = document.getElementById('player' + n + 'name');
		if (nameEl) nameEl.disabled = (t.value !== '0');
	});
}

// ------------------------------------------------------------
// Boot-up helpers extracted from window.onload. Each function is one
// concern; window.onload composes them. Keep them in declaration order
// when the order of execution matters (i18n must run before t() is used).
// ------------------------------------------------------------

function _initI18N() {
	if (typeof I18N === 'undefined') return;
	I18N.init();
	I18N.applyToDOM();
	// Refresh per-player labels ("Player 1:", "Player 2:", ...) using the chosen language.
	var labels = document.querySelectorAll('.player-label');
	for (var li = 0; li < labels.length; li++) {
		var n = labels[li].getAttribute('data-player-num');
		labels[li].textContent = I18N.t('setup.playerLabel', { n: n });
	}
	// "Just Visiting" sub-label on cell 10 — set via data attribute so the
	// CSS ::after rule picks it up. Tag both editions' cell 10.
	var justVisitCell = document.getElementById('cell10');
	if (justVisitCell) {
		justVisitCell.setAttribute('data-just-visiting-label', I18N.t('landed.justVisiting'));
	}
	// Highlight active language button.
	I18N.set(I18N.get());
}

function _injectAvatarPickers() {
	var AVATAR_OPTIONS = [
		{ id: 'sombrero',  label: '🎩 Sombrero',  file: 'images/sombrero.png'   },
		{ id: 'automovil', label: '🚗 Auto',      file: 'images/automovil.png'  },
		{ id: 'perro',     label: '🐕 Perro',     file: 'images/perro.png'      },
		{ id: 'gato',      label: '🐈 Gato',      file: 'images/gatoken.png'    },
		{ id: 'barco',     label: '⛵ Barco',     file: 'images/barco.png'      },
		{ id: 'zapato',    label: '👞 Zapato',    file: 'images/zapato.png'     },
		{ id: 'dedal',     label: '🪣 Dedal',     file: 'images/dedal.png'      },
		{ id: 'plancha',   label: '⚒️ Plancha',  file: 'images/plancha.png'    },
		// Locomotora.png (token-only artwork) replaces train_icon.png so the
		// player piece is visually distinct from the railroad cell icon.
		{ id: 'tren',      label: '🚂 Tren',      file: 'images/locomotora.png' }
	];
	window.GameConfig.avatarOptions = AVATAR_OPTIONS; // exposed for setup() lookup
	for (var ai = 1; ai <= 8; ai++) {
		var row = document.getElementById('player' + ai + 'input');
		if (!row || document.getElementById('player' + ai + 'avatar')) continue;
		var sel = document.createElement('select');
		sel.id = 'player' + ai + 'avatar';
		sel.className = 'player-avatar-select';
		sel.title = (typeof t === 'function' ? t('setup.playerAvatar') : 'Avatar');
		for (var ao = 0; ao < AVATAR_OPTIONS.length; ao++) {
			var opt = document.createElement('option');
			opt.value = AVATAR_OPTIONS[ao].id;
			opt.textContent = AVATAR_OPTIONS[ao].label;
			if (ao === (ai - 1) % AVATAR_OPTIONS.length) opt.selected = true;
			sel.appendChild(opt);
		}
		row.appendChild(sel);
		// Sprint Setup Item 2 — inject the visual pickers ABOVE/BESIDE the
		// (now hidden) native selects. The selects stay in the DOM because
		// monopoly.js setup() + the smoke tests both read `.value` from them
		// directly. The visual buttons just sync the select on click.
		__buildPlayerVisualPickers(ai, row, AVATAR_OPTIONS);
	}
}

// Build the compact visual customization UI for a single player row.
//
// New (redesign): the row now shows ONLY a clickable avatar preview + the
// name input + an AI-level dropdown (the dropdown is suppressed entirely
// for the human player slot — J1 by default — because the toggle is
// meaningless there). The token gallery + color swatches live in a single
// shared modal that opens when the avatar circle is clicked. The legacy
// <select> elements for color / ai / avatar stay in the DOM (hidden) so
// monopoly.js setup() + the smoke tests keep reading `.value` unchanged.
function __buildPlayerVisualPickers(n, row, AVATAR_OPTIONS) {
	if (!row || row.querySelector('.setup-player-visual')) return;

	var aiSel = document.getElementById('player' + n + 'ai');
	// Treat player 1 OR any slot currently set to "Human" (value "0") as
	// human. The native <select> below is still there for the engine; we
	// just hide the in-row UI for the human player slot.
	var isHumanSlot = (n === 1);

	var wrap = document.createElement('div');
	wrap.className = 'setup-player-visual';

	// 1. Clickable avatar preview — opens the customizer modal.
	var preview = document.createElement('button');
	preview.type = 'button';
	preview.className = 'setup-player-preview';
	preview.setAttribute('data-player-num', n);
	preview.setAttribute('aria-label', 'Customize player ' + n + ' token and color');
	preview.title = 'Personalizar ficha';
	preview.addEventListener('click', function () {
		__openCustomizerModal(n);
	});
	wrap.appendChild(preview);

	// 2. AI level — compact native <select> wrapped for icon prefix. Skipped
	//    entirely for the human slot.
	if (!isHumanSlot) {
		var aiBox = document.createElement('div');
		aiBox.className = 'setup-ai-dropdown';

		var aiPick = document.createElement('select');
		aiPick.className = 'setup-ai-dropdown-select';
		aiPick.setAttribute('aria-label', 'AI difficulty');
		// 5 options matching the hidden <select id="player{N}ai"> — emoji prefix
		// is purely cosmetic to telegraph the level at a glance.
		var AI_OPTS = [
			{ v: '0', text: '👤 Humano' },
			{ v: '1', text: '🎲 Fácil' },
			{ v: '2', text: '♟️ Normal' },
			{ v: '3', text: '👑 Difícil' },
			{ v: '4', text: '🧠 Adaptativa' }
		];
		AI_OPTS.forEach(function (o) {
			var opt = document.createElement('option');
			opt.value = o.v;
			opt.textContent = o.text;
			aiPick.appendChild(opt);
		});
		if (aiSel) aiPick.value = aiSel.value || '2';

		aiPick.addEventListener('change', function () {
			if (aiSel) {
				aiSel.value = aiPick.value;
				aiSel.dispatchEvent(new Event('change', { bubbles: true }));
			}
		});

		aiBox.appendChild(aiPick);
		wrap.appendChild(aiBox);
	}

	row.appendChild(wrap);
	row.classList.add('has-visual-pickers');
	if (isHumanSlot) row.classList.add('is-human-slot');

	__updatePlayerPreview(n);
}

// =====================================================================
// Customizer modal — a single shared modal that the avatar-circle click
// opens. Contains the live preview + the full token gallery + color
// swatches. Mirrors the hidden <select>s on every pick so the engine
// keeps reading state unchanged.
// =====================================================================
var __customizerCurrentPlayer = null;

function __openCustomizerModal(n) {
	var modal = __ensureCustomizerModal();
	__customizerCurrentPlayer = n;
	modal.setAttribute('data-player-num', n);

	// Update the title with the player's display name.
	var nameEl = document.getElementById('player' + n + 'name');
	var titleEl = modal.querySelector('.player-customizer-title');
	if (titleEl) {
		var who = (nameEl && nameEl.value) ? nameEl.value :
			((typeof t === 'function') ? t('setup.playerLabel', { n: n }) : 'Jugador ' + n);
		titleEl.textContent = (typeof t === 'function')
			? t('setup.customizeFor', { player: who })
			: 'Personalizar — ' + who;
	}

	// Reset selected state of every modal swatch from the canonical hidden
	// <select> values for this player.
	__syncCustomizerModalFromSelects(n);
	__updateCustomizerPreview(n);

	modal.classList.add('is-open');
	modal.setAttribute('aria-hidden', 'false');
	document.body.classList.add('player-customizer-open');
	// Focus the first interactive element inside the modal for keyboard users.
	var firstBtn = modal.querySelector('.setup-token-pick');
	if (firstBtn) firstBtn.focus();
}

function __closeCustomizerModal() {
	var modal = document.getElementById('player-customizer-modal');
	if (!modal) return;
	var n = __customizerCurrentPlayer;
	modal.classList.remove('is-open');
	modal.setAttribute('aria-hidden', 'true');
	document.body.classList.remove('player-customizer-open');
	__customizerCurrentPlayer = null;
	// Return focus to the avatar-circle that opened the modal.
	if (n != null) {
		var back = document.querySelector('.setup-player-preview[data-player-num="' + n + '"]');
		if (back && typeof back.focus === 'function') back.focus();
	}
}

function __ensureCustomizerModal() {
	var existing = document.getElementById('player-customizer-modal');
	if (existing) return existing;

	var AVATAR_OPTIONS = window.GameConfig && window.GameConfig.avatarOptions;
	if (!AVATAR_OPTIONS) return null;

	var COLORS_HEX = {
		'Aqua': '#00FFFF', 'Black': '#000000', 'Blue': '#0000FF', 'Fuchsia': '#FF00FF',
		'Gray': '#808080', 'Green': '#008000', 'Lime': '#00FF00', 'Maroon': '#800000',
		'Navy': '#000080', 'Olive': '#808000', 'Orange': '#FFA500', 'Purple': '#800080',
		'Red': '#FF0000', 'Silver': '#C0C0C0', 'Teal': '#008080', 'Yellow': '#FFFF00'
	};

	var modal = document.createElement('div');
	modal.id = 'player-customizer-modal';
	modal.setAttribute('role', 'dialog');
	modal.setAttribute('aria-modal', 'true');
	modal.setAttribute('aria-hidden', 'true');

	var backdrop = document.createElement('div');
	backdrop.className = 'player-customizer-backdrop';
	backdrop.addEventListener('click', __closeCustomizerModal);
	modal.appendChild(backdrop);

	var dialog = document.createElement('div');
	dialog.className = 'player-customizer-dialog';

	var header = document.createElement('div');
	header.className = 'player-customizer-header';
	var title = document.createElement('h3');
	title.className = 'player-customizer-title';
	title.textContent = 'Personalizar';
	header.appendChild(title);
	var closeBtn = document.createElement('button');
	closeBtn.type = 'button';
	closeBtn.className = 'player-customizer-close';
	closeBtn.setAttribute('aria-label', 'Close');
	closeBtn.innerHTML = '✕';
	closeBtn.addEventListener('click', __closeCustomizerModal);
	header.appendChild(closeBtn);
	dialog.appendChild(header);

	// Live preview circle inside the modal — updates as user picks.
	var preview = document.createElement('div');
	preview.className = 'player-customizer-preview';
	dialog.appendChild(preview);

	// Token gallery.
	var tokenLbl = document.createElement('div');
	tokenLbl.className = 'setup-picker-label';
	tokenLbl.textContent = (typeof t === 'function') ? t('setup.playerAvatar') : 'Token';
	dialog.appendChild(tokenLbl);

	var tokenGallery = document.createElement('div');
	tokenGallery.className = 'setup-token-gallery';
	tokenGallery.setAttribute('role', 'radiogroup');
	AVATAR_OPTIONS.forEach(function (av) {
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'setup-token-pick';
		btn.setAttribute('data-avatar', av.id);
		btn.setAttribute('role', 'radio');
		btn.setAttribute('aria-label', av.label);
		btn.title = av.label;
		btn.style.backgroundImage = "url('" + av.file + "')";
		btn.addEventListener('click', function () {
			var n = __customizerCurrentPlayer;
			if (n == null) return;
			var sel = document.getElementById('player' + n + 'avatar');
			if (sel) { sel.value = av.id; sel.dispatchEvent(new Event('change', { bubbles: true })); }
			tokenGallery.querySelectorAll('.setup-token-pick').forEach(function (b) {
				var picked = (b === btn);
				b.classList.toggle('is-selected', picked);
				b.setAttribute('aria-checked', picked ? 'true' : 'false');
			});
			__updateCustomizerPreview(n);
			__updatePlayerPreview(n);
		});
		tokenGallery.appendChild(btn);
	});
	dialog.appendChild(tokenGallery);

	// Color swatches.
	var colorLbl = document.createElement('div');
	colorLbl.className = 'setup-picker-label';
	colorLbl.textContent = (typeof t === 'function') ? t('setup.playerColor') : 'Color';
	dialog.appendChild(colorLbl);

	var colorGrid = document.createElement('div');
	colorGrid.className = 'player-customizer-colors';
	colorGrid.setAttribute('role', 'radiogroup');
	Object.keys(COLORS_HEX).forEach(function (colorName) {
		var swatch = document.createElement('button');
		swatch.type = 'button';
		swatch.className = 'setup-color-swatch';
		swatch.setAttribute('data-color', colorName);
		swatch.setAttribute('role', 'radio');
		swatch.setAttribute('aria-label', colorName);
		swatch.title = colorName;
		swatch.style.backgroundColor = COLORS_HEX[colorName];
		swatch.addEventListener('click', function () {
			var n = __customizerCurrentPlayer;
			if (n == null) return;
			var sel = document.getElementById('player' + n + 'color');
			if (sel) { sel.value = colorName; sel.dispatchEvent(new Event('change', { bubbles: true })); }
			colorGrid.querySelectorAll('.setup-color-swatch').forEach(function (s) {
				var picked = (s === swatch);
				s.classList.toggle('is-selected', picked);
				s.setAttribute('aria-checked', picked ? 'true' : 'false');
			});
			__updateCustomizerPreview(n);
			__updatePlayerPreview(n);
		});
		colorGrid.appendChild(swatch);
	});
	dialog.appendChild(colorGrid);

	// Done button at the bottom — same as backdrop click / ✕ / Esc.
	var doneBtn = document.createElement('button');
	doneBtn.type = 'button';
	doneBtn.className = 'player-customizer-done';
	doneBtn.textContent = (typeof t === 'function') ? t('setup.customizeDone') : 'Listo';
	doneBtn.addEventListener('click', __closeCustomizerModal);
	dialog.appendChild(doneBtn);

	modal.appendChild(dialog);
	document.body.appendChild(modal);

	// Esc key closes when the modal is open.
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Escape') return;
		if (!modal.classList.contains('is-open')) return;
		e.stopPropagation();
		__closeCustomizerModal();
	});

	return modal;
}

function __syncCustomizerModalFromSelects(n) {
	var modal = document.getElementById('player-customizer-modal');
	if (!modal) return;
	var avatar = document.getElementById('player' + n + 'avatar');
	var color  = document.getElementById('player' + n + 'color');
	if (avatar) {
		modal.querySelectorAll('.setup-token-pick').forEach(function (b) {
			var picked = (b.getAttribute('data-avatar') === avatar.value);
			b.classList.toggle('is-selected', picked);
			b.setAttribute('aria-checked', picked ? 'true' : 'false');
		});
	}
	if (color) {
		modal.querySelectorAll('.setup-color-swatch').forEach(function (s) {
			var picked = (s.getAttribute('data-color') === color.value);
			s.classList.toggle('is-selected', picked);
			s.setAttribute('aria-checked', picked ? 'true' : 'false');
		});
	}
}

function __updateCustomizerPreview(n) {
	var modal = document.getElementById('player-customizer-modal');
	if (!modal) return;
	var prev = modal.querySelector('.player-customizer-preview');
	if (!prev) return;
	var color = document.getElementById('player' + n + 'color');
	var avatar = document.getElementById('player' + n + 'avatar');
	if (color) prev.style.backgroundColor = color.value.toLowerCase();
	if (avatar) {
		var opts = window.GameConfig && window.GameConfig.avatarOptions;
		if (opts) {
			for (var i = 0; i < opts.length; i++) {
				if (opts[i].id === avatar.value) {
					prev.style.backgroundImage = "url('" + opts[i].file + "')";
					break;
				}
			}
		}
	}
}

// (Legacy v1 builder removed — its responsibilities are now split between
// __buildPlayerVisualPickers (compact in-row UI) and the customizer modal
// helpers above. The legacy <select>s are still kept hidden so the engine
// + smoke tests read state unchanged.)

// Read the canonical state from the hidden <select>s and propagate it to the
// visible compact UI: the AI-level dropdown in-row + the live preview circle.
// (Token + color pickers now live inside the shared customizer modal, which
// has its own sync helper — __syncCustomizerModalFromSelects.) Used on
// initial render + after _restoreSetupFromStorage / playernumber_onchange
// dispatches change events.
function __syncVisualPickersFromSelects(n) {
	var row = document.getElementById('player' + n + 'input');
	var ai = document.getElementById('player' + n + 'ai');

	// 1. In-row compact AI dropdown — mirror the canonical <select>'s value.
	if (ai && row) {
		var aiPick = row.querySelector('.setup-ai-dropdown-select');
		if (aiPick && aiPick.value !== ai.value) aiPick.value = ai.value;
	}

	// 2. Live preview circle (avatar + color) — handled by __updatePlayerPreview.
	__updatePlayerPreview(n);

	// 3. If the customizer modal happens to be open for this player, keep its
	//    swatches in sync too (otherwise they'd lag behind a programmatic
	//    update — e.g. restore-from-storage).
	if (__customizerCurrentPlayer === n) {
		__syncCustomizerModalFromSelects(n);
		__updateCustomizerPreview(n);
	}
}

// Refresh the live preview circle (avatar PNG on tinted background) for
// player `n`. Called whenever color or avatar changes.
function __updatePlayerPreview(n) {
	var prev = document.querySelector('.setup-player-preview[data-player-num="' + n + '"]');
	if (!prev) return;
	var color = document.getElementById('player' + n + 'color');
	var avatar = document.getElementById('player' + n + 'avatar');
	if (color) {
		prev.style.backgroundColor = color.value.toLowerCase();
	}
	if (avatar) {
		// Map the avatar id to its PNG path via GameConfig.avatarOptions.
		var opts = window.GameConfig && window.GameConfig.avatarOptions;
		if (opts) {
			for (var i = 0; i < opts.length; i++) {
				if (opts[i].id === avatar.value) {
					prev.style.backgroundImage = "url('" + opts[i].file + "')";
					break;
				}
			}
		}
	}
}

// Restore setup form from localStorage. Defensive: every field is validated
// (the blob is user-editable and could be corrupted or tampered).
function _restoreSetupFromStorage() {
	try {
		var saved = window.localStorage.getItem('monopoly:setup');
		if (!saved) return;
		var s = JSON.parse(saved);
		if (!s || typeof s !== 'object') s = {};
		if (typeof s.pcount === 'number' && s.pcount >= 2 && s.pcount <= 8) {
			var pn = document.getElementById('playernumber');
			if (pn) pn.value = s.pcount;
		}
		if (s.players && typeof s.players === 'object') {
			for (var pi = 1; pi <= 8; pi++) {
				var slot = s.players[pi];
				if (!slot || typeof slot !== 'object') continue;
				var nameEl = document.getElementById('player' + pi + 'name');
				var colorEl = document.getElementById('player' + pi + 'color');
				var aiEl = document.getElementById('player' + pi + 'ai');
				var avEl = document.getElementById('player' + pi + 'avatar');
				if (nameEl && typeof slot.name === 'string')   nameEl.value  = slot.name.slice(0, 16);
				if (colorEl && typeof slot.color === 'string') colorEl.value = slot.color;
				if (aiEl && (typeof slot.ai === 'number' || typeof slot.ai === 'string')) aiEl.value = String(slot.ai);
				if (avEl && typeof slot.avatar === 'string')  avEl.value  = slot.avatar;
				if (nameEl && aiEl) nameEl.disabled = aiEl.value !== '0';
			}
		}
		if (typeof s.cash === 'number' && typeof window.__applyPreset === 'function') {
			var presetKey = s.cash === 1000 ? 'quick' : (s.cash === 2500 ? 'long' : 'standard');
			try { window.__applyPreset(presetKey); } catch (e) { /* preset load: ignore */ }
		}
		if (s.rules && typeof s.rules === 'object') {
			var ruleMap = {
				freeParkingJackpot: 'rule-free-parking-jackpot',
				snakeEyesBonus:     'rule-snake-eyes-bonus',
				doubleGo:           'rule-double-go',
				noAuctions:         'rule-no-auctions',
				speedMode:          'rule-speed-mode'
			};
			for (var rk in ruleMap) {
				if (!s.rules.hasOwnProperty(rk)) continue;
				var rEl = document.getElementById(ruleMap[rk]);
				if (rEl) rEl.checked = !!s.rules[rk];
			}
			var anyRule = Object.keys(s.rules).some(function (k) { return !!s.rules[k]; });
			if (anyRule) {
				var hr = document.getElementById('house-rules-block');
				if (hr) hr.open = true;
			}
		}
	} catch (e) { /* localStorage may be disabled — proceed with defaults */ }
}

// Build the Game + Player array, link properties into color groups, shuffle decks.
function _initGameState() {
	game = new Game();

	for (var i = 0; i <= 8; i++) {
		player[i] = new Player("", "");
		player[i].index = i;
	}

	var groupPropertyArray = [];
	for (var i = 0; i < 40; i++) {
		var g = square[i].groupNumber;
		if (g > 0) {
			if (!groupPropertyArray[g]) groupPropertyArray[g] = [];
			groupPropertyArray[g].push(i);
		}
	}
	for (var i = 0; i < 40; i++) {
		var g = square[i].groupNumber;
		if (g > 0) square[i].group = groupPropertyArray[g];
		square[i].index = i;
	}

	AITest.count = 0;
	player[1].human = true;
	player[0].name = (typeof t === 'function') ? t('common.thebank') : 'the bank';

	communityChestCards.index = 0;
	chanceCards.index = 0;
	communityChestCards.deck = [];
	chanceCards.deck = [];
	for (var i = 0; i < 16; i++) {
		chanceCards.deck[i] = i;
		communityChestCards.deck[i] = i;
	}
	__shuffle(chanceCards.deck);
	__shuffle(communityChestCards.deck);
}

// Wire former inline onclick= handlers from index.html (removed for CSP-
// friendliness). Delegated where multiple buttons share a behaviour.
function _wireGlobalButtons() {
	document.querySelectorAll('.lang-btn').forEach(function (b) {
		b.addEventListener('click', function () { I18N.set(b.getAttribute('data-lang')); });
	});
	document.querySelectorAll('.setup-preset').forEach(function (b) {
		b.addEventListener('click', function () {
			if (typeof window.__applyPreset === 'function') window.__applyPreset(b.getAttribute('data-preset'));
			// Sprint Setup Item 3 — visual active state for preset row.
			document.querySelectorAll('.setup-preset').forEach(function (other) {
				other.classList.toggle('setup-preset-active', other === b);
				other.setAttribute('aria-pressed', other === b ? 'true' : 'false');
			});
		});
	});
	var byId = function (id, fn) {
		var el = document.getElementById(id);
		if (el) el.addEventListener('click', fn);
	};
	// Sprint Setup Item 3 — PLAY button: smooth setup-leaving fade. If the
	// edition picker changed since page load (vs the active edition in
	// GameConfig), do a soft transition (fade-out + splash-in + reload)
	// instead of a hard reload that flashes black.
	byId('start-game-btn', function () {
		var setupEl = document.getElementById('setup');
		var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		var editionSel2 = document.getElementById('edition-select');
		var pickedEdition = editionSel2 ? editionSel2.value : null;
		var activeEdition = (window.GameConfig && window.GameConfig.edition) || 'classic';
		var needsReload = pickedEdition && pickedEdition !== activeEdition;

		function commitStart() {
			if (needsReload) {
				// Persist + reload with a fade-to-splash so there's no flash.
				try { window.localStorage.setItem('monopoly:edition', pickedEdition); } catch (e) {}
				// Show a temporary "loading next edition" overlay before reload.
				var loader = document.createElement('div');
				loader.id = 'setup-edition-loader';
				loader.innerHTML = '<div class="setup-edition-loader-inner">' +
					'<div class="splash-logo">MONOPOLY</div>' +
					'<div class="splash-loader"><span></span><span></span><span></span></div>' +
					'</div>';
				document.body.appendChild(loader);
				// Fade-in the loader then reload.
				requestAnimationFrame(function () {
					loader.classList.add('is-visible');
					setTimeout(function () { window.location.reload(); }, 320);
				});
			} else {
				setup();
			}
		}

		if (setupEl && !reduce) {
			setupEl.classList.add('setup-leaving');
			setTimeout(commitStart, 380);
		} else {
			commitStart();
		}
	});
	byId('resignbutton',        function () { game.resign(); });
	byId('proposetradebutton',  function () { game.proposeTrade(); });
	byId('canceltradebutton',   function () { game.cancelTrade(); });
	byId('accepttradebutton',   function () { game.acceptTrade(); });
	byId('rejecttradebutton',   function () { game.cancelTrade(); });

	// Edition selector: hidden <select> stays for monopoly.js / tests.
	// Importantly, we DO NOT fire a page reload here — the edition only
	// commits when the user clicks PLAY (see byId('start-game-btn') above).
	// This avoids the harsh black flash that the old reload-on-change
	// produced and lets the user toggle editions while exploring the setup.
	var editionSel = document.getElementById('edition-select');
	if (editionSel) {
		editionSel.value = (window.GameConfig && window.GameConfig.edition) || 'classic';
	}
	// Sprint Setup Item 3 — edition cards wire. Click only syncs the
	// hidden <select>'s value + toggles visual selected state. No reload.
	document.querySelectorAll('.setup-edition-card').forEach(function (card) {
		card.addEventListener('click', function () {
			var ed = card.getAttribute('data-edition');
			document.querySelectorAll('.setup-edition-card').forEach(function (c) {
				var picked = (c === card);
				c.classList.toggle('is-selected', picked);
				c.setAttribute('aria-checked', picked ? 'true' : 'false');
			});
			if (editionSel) editionSel.value = ed;
			// Pre-warm the new edition's music so the eventual PLAY click
			// has the MP3 already buffered. This kicks off in the background;
			// failures are silent (most likely cause: no AudioContext yet,
			// which is fine — playMusic() will fetch when it eventually runs).
			if (typeof Sound !== 'undefined' && Sound.preloadMusicForEdition) {
				try { Sound.preloadMusicForEdition(ed); } catch (e) {}
			}
		});
		// Initial selected state matches the hidden select on load.
		if (editionSel && card.getAttribute('data-edition') === editionSel.value) {
			card.classList.add('is-selected');
			card.setAttribute('aria-checked', 'true');
		}
	});
}

// Build the 40 board cells (anchor, color strip, name, price chip, owner
// marker, buildings container) and wire hover/click handlers.
function _initBoardCells() {
	var enlargeWrap = document.body.appendChild(document.createElement("div"));
	enlargeWrap.id = "enlarge-wrap";

	var HTML = "";
	for (var i = 0; i < 40; i++) {
		HTML += "<div id='enlarge" + i + "' class='enlarge'>";
		HTML += "<div id='enlarge" + i + "color' class='enlarge-color'></div><br /><div id='enlarge" + i + "name' class='enlarge-name'></div>";
		HTML += "<br /><div id='enlarge" + i + "price' class='enlarge-price'></div>";
		HTML += "<br /><div id='enlarge" + i + "token' class='enlarge-token'></div></div>";
	}
	enlargeWrap.innerHTML = HTML;

	for (var i = 0; i < 40; i++) {
		var s = square[i];
		var currentCell = document.getElementById("cell" + i);

		var currentCellAnchor = currentCell.appendChild(document.createElement("div"));
		currentCellAnchor.id = "cell" + i + "anchor";
		currentCellAnchor.className = "cell-anchor";

		if (s.groupNumber >= 3) {
			var currentCellColor = currentCellAnchor.appendChild(document.createElement("div"));
			currentCellColor.id = "cell" + i + "color";
			currentCellColor.className = "cell-color";
			currentCellColor.style.backgroundColor = s.color;
		}

		var currentCellPositionHolder = currentCellAnchor.appendChild(document.createElement("div"));
		currentCellPositionHolder.id = "cell" + i + "positionholder";
		currentCellPositionHolder.className = "cell-position-holder";
		currentCellPositionHolder.enlargeId = "enlarge" + i;

		var currentCellName = currentCellAnchor.appendChild(document.createElement("div"));
		currentCellName.id = "cell" + i + "name";
		currentCellName.className = "cell-name";
		currentCellName.textContent = s.name;

		if (square[i].price && square[i].price > 0 && square[i].groupNumber) {
			var priceEl = currentCellAnchor.appendChild(document.createElement("div"));
			priceEl.id = "cell" + i + "price";
			priceEl.className = "cell-price";
			priceEl.textContent = "$" + square[i].price;
		}

		if (square[i].groupNumber) {
			var currentCellOwner = currentCellAnchor.appendChild(document.createElement("div"));
			currentCellOwner.id = "cell" + i + "owner";
			currentCellOwner.className = "cell-owner";
		}

		if (s.groupNumber >= 3) {
			var currentCellBuildings = currentCellAnchor.appendChild(document.createElement("div"));
			currentCellBuildings.id = "cell" + i + "buildings";
			currentCellBuildings.className = "cell-buildings";
		}

		document.getElementById("enlarge" + i + "color").style.backgroundColor = s.color;
		document.getElementById("enlarge" + i + "name").textContent = s.name;
		document.getElementById("enlarge" + i + "price").textContent = s.pricetext;
	}

	// Hover preview: any property/railroad/utility cell shows its deed tooltip.
	for (var hi = 0; hi < 40; hi++) {
		(function (idx) {
			var cellEl = document.getElementById('cell' + idx);
			if (!cellEl) return;
			cellEl.addEventListener('mouseenter', function (e) { __cellHoverEnter(idx, e); });
			cellEl.addEventListener('mousemove',  function (e) { __cellHoverEnter(idx, e); });
			cellEl.addEventListener('mouseleave', function ()  { __cellHoverLeave(idx); });
			// Click ripple from the click point — cosmetic only. Suppressed
			// during AI turns so the board feels locked.
			cellEl.addEventListener('mousedown', function (e) {
				if (document.body.getAttribute('data-await') === 'ai') return;
				var r = cellEl.getBoundingClientRect();
				var size = Math.max(r.width, r.height) * 1.5;
				var ripple = document.createElement('span');
				ripple.className = 'cell-ripple';
				ripple.style.width = size + 'px';
				ripple.style.height = size + 'px';
				ripple.style.left = (e.clientX - r.left) + 'px';
				ripple.style.top  = (e.clientY - r.top)  + 'px';
				cellEl.appendChild(ripple);
				setTimeout(function () { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 540);
			});
		})(hi);
	}
}

// Drag handlers for #popup / #stats. Shared `drag` state lives in closure.
function _initDragHandlers() {
	var drag = false, dragX, dragY, dragObj, dragTop, dragLeft;

	document.body.addEventListener("mousemove", function (e) {
		var object = e.target;
		if (object.classList.contains("propertycellcolor") || object.classList.contains("statscellcolor")) {
			if (e.clientY + 20 > window.innerHeight - 279) {
				document.getElementById("deed").style.top = (window.innerHeight - 279) + "px";
			} else {
				document.getElementById("deed").style.top = (e.clientY + 20) + "px";
			}
			document.getElementById("deed").style.left = (e.clientX + 10) + "px";
		} else if (drag) {
			var ex = e.clientX, ey = e.clientY;
			// Convert raw viewport delta -> stage-local delta (inverse of stage transform).
			var stx = window.__STAGE_TX || { scale: 1, cos: 1, sin: 0 };
			var rawDx = ex - dragX;
			var rawDy = ey - dragY;
			var localDx = (rawDx * stx.cos + rawDy * stx.sin) / stx.scale;
			var localDy = (-rawDx * stx.sin + rawDy * stx.cos) / stx.scale;
			dragObj.style.left = (dragLeft + localDx) + "px";
			dragObj.style.top  = (dragTop  + localDy) + "px";
		}
	});

	document.body.addEventListener("mouseup", function () { drag = false; });

	function attachDrag(handleId, targetId) {
		var handle = document.getElementById(handleId);
		if (!handle) return;
		handle.onmousedown = function (e) {
			dragObj = document.getElementById(targetId);
			dragObj.style.position = "relative";
			dragTop  = parseInt(dragObj.style.top,  10) || 0;
			dragLeft = parseInt(dragObj.style.left, 10) || 0;
			dragX = e.clientX;
			dragY = e.clientY;
			drag = true;
		};
	}
	attachDrag('statsdrag', 'stats');
	attachDrag('popupdrag', 'popup');
}

// Tab switching + manage panel buttons (buy house, sell house, mortgage).
function _wireManagePanel() {
	UI.$on("mortgagebutton", "click", function () {
		var checkedProperty = getCheckedProperty();
		var s = square[checkedProperty];
		if (s.mortgage) {
			if (player[s.owner].money < Math.round(s.price * 0.55)) {
				popup("<p>" + t('popup.unmortgageShort', { amount: (Math.round(s.price * 0.55) - player[s.owner].money), place: s.name }) + "</p>");
			} else {
				popup("<p>" + t('popup.unmortgageConfirm', { player: player[s.owner].name, place: s.name, amount: Math.round(s.price * 0.55) }) + "</p>", function () {
					unmortgage(checkedProperty);
				}, "Yes/No");
			}
		} else {
			popup("<p>" + t('popup.mortgageConfirm', { player: player[s.owner].name, place: s.name, amount: Math.round(s.price * 0.5) }) + "</p>", function () {
				mortgage(checkedProperty);
			}, "Yes/No");
		}
	});

	UI.$on("buyhousebutton", "click", function () {
		var checkedProperty = getCheckedProperty();
		var s = square[checkedProperty];
		var p = player[s.owner];
		var houseSum = 0, hotelSum = 0;
		if (p.money < s.houseprice) {
			if (s.house === 4) {
				popup("<p>" + t('popup.needForHotel', { amount: (s.houseprice - player[s.owner].money), place: s.name }) + "</p>");
			} else {
				popup("<p>" + t('popup.needForHouse', { amount: (s.houseprice - player[s.owner].money), place: s.name }) + "</p>");
			}
			return;
		}
		for (var i = 0; i < 40; i++) {
			if (square[i].hotel === 1) hotelSum++;
			else houseSum += square[i].house;
		}
		if (s.house < 4 && houseSum >= 32) {
			popup("<p>" + t('popup.allHousesOwned') + "</p>"); return;
		} else if (s.house === 4 && hotelSum >= 12) {
			popup("<p>" + t('popup.allHotelsOwned') + "</p>"); return;
		}
		buyHouse(checkedProperty);
	});

	// Hover previews on manage buttons — show the cash impact of the action.
	var __btnBuyHouse = document.getElementById("buyhousebutton");
	if (__btnBuyHouse) {
		__btnBuyHouse.addEventListener('mouseenter', function () {
			var idx = getCheckedProperty();
			var sq = square[idx];
			if (!sq || sq.owner === 0) return;
			var p = player[sq.owner];
			__showConsequencePreview(this, p.money, -sq.houseprice, 150);
		});
		__btnBuyHouse.addEventListener('mouseleave', __hideConsequencePreview);
	}

	var __btnMortgage = document.getElementById("mortgagebutton");
	if (__btnMortgage) {
		__btnMortgage.addEventListener('mouseenter', function () {
			var idx = getCheckedProperty();
			var sq = square[idx];
			if (!sq || sq.owner === 0) return;
			var p = player[sq.owner];
			var delta = sq.mortgage
				? -Math.round(sq.price * 0.55)   // unmortgaging costs 10% interest
				:  Math.round(sq.price * 0.5);   // mortgaging pays out half
			__showConsequencePreview(this, p.money, delta, 200);
		});
		__btnMortgage.addEventListener('mouseleave', __hideConsequencePreview);
	}

	var __btnSellHouse = document.getElementById("sellhousebutton");
	if (__btnSellHouse) {
		__btnSellHouse.addEventListener('mouseenter', function () {
			var idx = getCheckedProperty();
			var sq = square[idx];
			if (!sq || sq.owner === 0 || (sq.house === 0 && !sq.hotel)) return;
			var p = player[sq.owner];
			__showConsequencePreview(this, p.money, Math.round(sq.houseprice * 0.5));
		});
		__btnSellHouse.addEventListener('mouseleave', __hideConsequencePreview);
	}

	UI.$on("sellhousebutton", "click", function () {
		var idx = getCheckedProperty();
		var sq = square[idx];
		if (!sq) return;
		// Confirm before selling the last building of a monopolized group.
		var groupMonopolized = !!sq.owner;
		var totalBuildings = 0;
		if (sq.group) {
			for (var gi = 0; gi < sq.group.length; gi++) {
				var gs = square[sq.group[gi]];
				if (gs.owner !== sq.owner) { groupMonopolized = false; break; }
				totalBuildings += gs.house + (gs.hotel ? 5 : 0);
			}
		}
		var sellingHotel = sq.hotel === 1;
		var lastBuilding = groupMonopolized && totalBuildings === 1 && sq.house === 1 && !sq.hotel;
		if (sellingHotel || lastBuilding) {
			var msg = sellingHotel
				? t('popup.confirmSellHotel', { place: sq.name })
				: t('popup.confirmSellLast', { place: sq.name });
			popup('<p>' + msg + '</p>', function () { sellHouse(idx); }, 'Yes/No');
		} else {
			sellHouse(idx);
		}
	});

	UI.$on("viewstats", "click", showStats);
	var __statsCloseHandler = function () {
		UI.$hide("statswrap");
		UI.$fadeOut("statsbackground", 400);
		// If we opened stats from inside the victory overlay, bring it back.
		if (window.GameState.victoryOverlay && window.GameState.victoryOverlay.parentNode) {
			var ov = window.GameState.victoryOverlay;
			ov.style.visibility = '';
			ov.style.transition = 'opacity 280ms ease-out';
			ov.style.opacity = '0';
			requestAnimationFrame(function () { ov.style.opacity = '1'; });
			setTimeout(function () { ov.style.transition = ''; }, 320);
		}
	};
	UI.$on("statsclose", "click", __statsCloseHandler);
	UI.$on("statsbackground", "click", __statsCloseHandler);
}

// Money-bar row clicks/hovers: click opens stats, hover highlights that
// player's token on the board.
function _wireMoneyBarInteractivity() {
	for (var pi = 1; pi <= 8; pi++) {
		(function (slot) {
			var row = document.getElementById('p' + slot + 'moneybar');
			if (!row) return;
			row.style.cursor = 'pointer';
			row.addEventListener('click', function () {
				if (typeof showStats === 'function') showStats();
			});
			row.addEventListener('mouseenter', function () {
				var tok = __tokens && __tokens[slot];
				if (tok && tok.el) tok.el.classList.add('token-mb-spot');
			});
			row.addEventListener('mouseleave', function () {
				var tok = __tokens && __tokens[slot];
				if (tok && tok.el) tok.el.classList.remove('token-mb-spot');
			});
		})(pi);
	}
}

// Buy / Manage / Trade tab switchers. The Trade button defers to game.trade()
// since opening it has side-effects (player picker).
function _wireTabSwitchers() {
	function markActive(id) {
		var items = document.querySelectorAll('.menu-item');
		for (var i = 0; i < items.length; i++) items[i].classList.remove('menu-item-active');
		var hit = document.getElementById(id);
		if (hit) hit.classList.add('menu-item-active');
	}
	UI.$on("buy-menu-item", "click", function () {
		UI.$show("buy"); UI.$hide("manage"); UI.$hide("trade");
		markActive('buy-menu-item');
		var __alertEl = document.getElementById("alert");
		if (__alertEl) __alertEl.scrollTop = __alertEl.scrollHeight;
	});
	UI.$on("manage-menu-item", "click", function () {
		UI.$show("manage"); UI.$hide("buy"); UI.$hide("trade");
		markActive('manage-menu-item');
	});
	UI.$on("trade-menu-item", "click", function () {
		if (typeof game.trade === 'function') game.trade();
		markActive('trade-menu-item');
	});
	markActive('buy-menu-item'); // initial state matches the default visible panel
}

// Theme cycle: auto → light → dark → auto. Applied to <html> via classes
// so the inline boot script (in index.html) keeps the chosen state across
// reloads without a FOUC.
function _initThemeToggle() {
	var btn = document.getElementById('theme-btn');
	if (!btn) return;
	var ORDER = ['auto', 'light', 'dark'];

	function apply(mode) {
		var root = document.documentElement;
		root.classList.remove('theme-light', 'theme-dark');
		if (mode === 'light') root.classList.add('theme-light');
		else if (mode === 'dark') root.classList.add('theme-dark');
		btn.setAttribute('data-theme', mode);
		// Title reflects the active mode + cycle hint, translated.
		if (typeof t === 'function') {
			var label = t('ui.theme' + mode.charAt(0).toUpperCase() + mode.slice(1));
			btn.title = t('ui.themeToggle', { mode: label });
		}
		window.GameConfig.theme = mode;
		try { window.localStorage.setItem('monopoly:theme', mode); } catch (e) { /* localStorage unavailable */ }
	}

	apply(window.GameConfig.theme || 'auto');
	btn.addEventListener('click', function () {
		var current = window.GameConfig.theme || 'auto';
		var next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
		apply(next);
	});
}

// Settings dropdown — wraps the gear button + the popover (#settings-menu).
// Click on the gear toggles .open, clicking outside or pressing Esc closes
// it. The buttons inside the menu (mute / theme / help / lang) keep their
// own wiring from _initThemeToggle / mute listener / etc; this function
// only manages the open/closed state of the container.
function _initSettingsMenu() {
	var btn  = document.getElementById('settings-btn');
	var menu = document.getElementById('settings-menu');
	if (!btn || !menu) return;
	function open()  { menu.classList.add('open');    menu.setAttribute('aria-hidden','false'); btn.setAttribute('aria-expanded','true');  }
	function close() { menu.classList.remove('open'); menu.setAttribute('aria-hidden','true');  btn.setAttribute('aria-expanded','false'); }
	function toggle(){ menu.classList.contains('open') ? close() : open(); }
	btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
	// Outside click closes — capture so we beat any inner handlers.
	document.addEventListener('mousedown', function (e) {
		if (!menu.classList.contains('open')) return;
		if (menu.contains(e.target) || btn.contains(e.target)) return;
		close();
	}, true);
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && menu.classList.contains('open')) { e.preventDefault(); close(); }
	});
	// Clicks on the lang/sound/help/theme rows shouldn't close the menu
	// reflexively — let the user pick multiple settings without re-opening.
	// We only close on the outside-click path above.
	window.__closeSettingsMenu = close;
}

// Setup hero particles — small golden dots that drift upward through the
// hero block. CSS handles the rise + fade animation; we just inject the
// nodes with randomized left + animation-delay + duration so the result
// looks organic rather than synchronized.
function _spawnSetupParticles() {
	var host = document.querySelector('#setup-hero .setup-particles');
	if (!host) return;
	// Lower particle count on small screens to keep mobile fps healthy.
	var count = (window.innerWidth < 600) ? 8 : 16;
	// Already populated? Skip (idempotent — boot might run twice in dev).
	if (host.children.length >= count) return;
	for (var i = 0; i < count; i++) {
		var p = document.createElement('span');
		p.className = 'setup-particle';
		p.style.left = (Math.random() * 100) + '%';
		p.style.animationDelay = (-Math.random() * 7).toFixed(2) + 's';
		p.style.animationDuration = (6 + Math.random() * 4).toFixed(2) + 's';
		p.style.width = (3 + Math.random() * 3).toFixed(1) + 'px';
		p.style.height = p.style.width;
		host.appendChild(p);
	}
}

// Global click-outside handler: any click that isn't inside an open color
// row (or its chip/popover) closes the popover. Set up once on boot.
function _wireColorPopovers() {
	document.addEventListener('click', function (e) {
		var openRow = document.querySelector('.setup-color-row.is-open');
		if (!openRow) return;
		if (openRow.contains(e.target)) return;
		openRow.classList.remove('is-open');
		var chip = openRow.querySelector('.setup-color-chip');
		if (chip) chip.setAttribute('aria-expanded', 'false');
		var pop = openRow.querySelector('.setup-color-pop');
		if (pop) pop.setAttribute('aria-hidden', 'true');
	});
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Escape') return;
		document.querySelectorAll('.setup-color-row.is-open').forEach(function (row) {
			row.classList.remove('is-open');
			var chip = row.querySelector('.setup-color-chip');
			if (chip) chip.setAttribute('aria-expanded', 'false');
		});
	});
}

window.onload = function() {
	__renderPlayerSetup();
	_initI18N();
	_initThemeToggle();
	_initSettingsMenu();
	_spawnSetupParticles();
	_wireColorPopovers();
	// Warm up the music file for the current edition while the user is on
	// the setup screen. By the time they click PLAY the MP3 is already
	// buffered, so the audio decode no longer competes with the board's
	// first paint (which used to look like the board "restarted").
	if (typeof Sound !== 'undefined' && Sound.preloadMusicForEdition) {
		var __doPreload = function () {
			try {
				Sound.preloadMusicForEdition((window.GameConfig && window.GameConfig.edition) || 'classic');
			} catch (e) { /* preload best-effort */ }
		};
		if (window.requestIdleCallback) requestIdleCallback(__doPreload, { timeout: 2500 });
		else setTimeout(__doPreload, 800);
	}

	fitStage();
	window.addEventListener('resize', fitStage);
	window.addEventListener('orientationchange', fitStage);

	// Keyboard shortcuts: Esc closes modals; Space rolls/end-turns; B/M/T/S switch tabs.
	if (typeof UI !== 'undefined') {
		UI.ensureOverlay();
		UI.bindKeys();
	}

	// Mute toggle — reflect saved state, click to toggle.
	if (typeof Sound !== 'undefined') {
		var muteBtn = document.getElementById('mute-btn');
		if (muteBtn) {
			if (Sound.isMuted()) muteBtn.classList.add('muted');
			muteBtn.addEventListener('click', function () {
				var newMuted = !Sound.isMuted();
				Sound.setMuted(newMuted);
				if (newMuted) muteBtn.classList.add('muted');
				else          muteBtn.classList.remove('muted');
				// Brief audible confirmation when un-muting so the user knows it worked.
				if (!newMuted) Sound.ding();
			});
		}
	}

	// Help modal — open via #help-btn or "?" key, close via X / Esc / backdrop click.
	(function () {
		var overlay = document.getElementById('help-overlay');
		var btn = document.getElementById('help-btn');
		var close = document.getElementById('help-close');
		if (!overlay) return;

		function open() {
			overlay.classList.add('help-open');
			overlay.setAttribute('aria-hidden', 'false');
		}
		function hide() {
			overlay.classList.remove('help-open');
			overlay.setAttribute('aria-hidden', 'true');
		}
		if (btn)   btn.addEventListener('click', open);
		if (close) close.addEventListener('click', hide);
		// Click on backdrop (but not on the modal itself) closes.
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) hide();
		});
		// "?" key + Esc — added here (UI.bindKeys already handles Esc-to-close-popup;
		// we wire "?" + Esc-for-help specifically since the help overlay is its own thing).
		document.addEventListener('keydown', function (e) {
			var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
			if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
			if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); open(); }
			else if (e.key === 'Escape' && overlay.classList.contains('help-open')) {
				e.preventDefault(); hide();
			}
		});
		// Expose for the onboarding tour (Block 2 step 2) to call programmatically.
		window.__openHelp = open;
		window.__closeHelp = hide;
	})();

	// =============================================================
	// Onboarding tour — first-time-only series of coachmarks.
	// Triggers from setup() (game start). Steps are an array of
	// { target, titleKey, bodyKey, side } objects.
	// =============================================================
	(function () {
		var overlay = document.getElementById('tour-overlay');
		var spotlight = document.getElementById('tour-spotlight');
		var tip = document.getElementById('tour-tooltip');
		var titleEl = document.getElementById('tour-title');
		var bodyEl  = document.getElementById('tour-body');
		var dotsEl  = document.getElementById('tour-dots');
		var nextBtn = document.getElementById('tour-next');
		var skipBtn = document.getElementById('tour-skip');
		if (!overlay) return;

		var steps = [];
		var idx = 0;

		function defineSteps() {
			return [
				{ target: '#nextbutton', titleKey: 'tour.s1.title', bodyKey: 'tour.s1.body', side: 'left' },
				{ target: '#board',      titleKey: 'tour.s2.title', bodyKey: 'tour.s2.body', side: 'right' },
				{ target: '#moneybar',   titleKey: 'tour.s3.title', bodyKey: 'tour.s3.body', side: 'left' },
				{ target: '#help-btn',   titleKey: 'tour.s4.title', bodyKey: 'tour.s4.body', side: 'left' }
			];
		}

		function position(targetEl, side) {
			var r = targetEl.getBoundingClientRect();
			// Spotlight matches the target with 8px padding around for visual breathing.
			var pad = 8;
			spotlight.style.top    = (r.top    - pad) + 'px';
			spotlight.style.left   = (r.left   - pad) + 'px';
			spotlight.style.width  = (r.width  + pad * 2) + 'px';
			spotlight.style.height = (r.height + pad * 2) + 'px';

			// Position tooltip near the spotlight.
			var tipR = tip.getBoundingClientRect();
			var top, left;
			if (side === 'right') {
				top = r.top + r.height / 2 - tipR.height / 2;
				left = r.right + 24;
			} else if (side === 'bottom') {
				top = r.bottom + 18;
				left = r.left + r.width / 2 - tipR.width / 2;
			} else {
				// default: left
				top = r.top + r.height / 2 - tipR.height / 2;
				left = r.left - tipR.width - 24;
			}
			// Clamp to viewport.
			top  = Math.max(16, Math.min(top,  window.innerHeight - tipR.height - 16));
			left = Math.max(16, Math.min(left, window.innerWidth  - tipR.width  - 16));
			tip.style.top = top + 'px';
			tip.style.left = left + 'px';
		}

		function renderDots() {
			while (dotsEl.firstChild) dotsEl.removeChild(dotsEl.firstChild);
			for (var i = 0; i < steps.length; i++) {
				var d = document.createElement('span');
				d.className = 'tour-dot' + (i === idx ? ' active' : '');
				dotsEl.appendChild(d);
			}
		}

		function show(i) {
			if (i >= steps.length) { finish(); return; }
			idx = i;
			var step = steps[i];
			var target = document.querySelector(step.target);
			if (!target) { show(i + 1); return; }
			titleEl.textContent = (typeof t === 'function' ? t(step.titleKey) : step.titleKey);
			bodyEl.textContent  = (typeof t === 'function' ? t(step.bodyKey)  : step.bodyKey);
			nextBtn.textContent = (i === steps.length - 1)
				? (typeof t === 'function' ? t('tour.finish') : 'Got it')
				: (typeof t === 'function' ? t('tour.next')   : 'Next');
			renderDots();
			// Position after the next frame so the tooltip's measured size is correct.
			requestAnimationFrame(function () { position(target, step.side); });
		}

		function finish() {
			overlay.classList.remove('tour-active');
			overlay.setAttribute('aria-hidden', 'true');
			try { window.localStorage.setItem('monopoly:tourSeen', '1'); } catch (e) { /* localStorage unavailable */ }
		}

		function start() {
			try {
				if (window.localStorage.getItem('monopoly:tourSeen') === '1') return;
			} catch (e) { /* localStorage unavailable: show tour anyway */ }
			steps = defineSteps();
			idx = 0;
			overlay.classList.add('tour-active');
			overlay.setAttribute('aria-hidden', 'false');
			// Wait a tick so the layout settles after setup() finishes.
			setTimeout(function () { show(0); }, 600);
		}

		// Re-show is also available via help modal in future.
		nextBtn.addEventListener('click', function () { show(idx + 1); });
		skipBtn.addEventListener('click', finish);

		// Expose for setup() to call + reposition on resize while active.
		window.__startTour = start;
		window.addEventListener('resize', function () {
			if (overlay.classList.contains('tour-active') && steps[idx]) {
				var target = document.querySelector(steps[idx].target);
				if (target) position(target, steps[idx].side);
			}
		});
	})();

	// Initialize the 3D dice cubes + the physical throw system. Cubes
	// are built immediately (not lazily on first roll) so the dice are
	// grabbable from the moment they become visible.
	// The default pose shows 3 faces (rotateX -22, rotateY -32) — much
	// more cube-like than a flat single-face view.
	['die0', 'die1'].forEach(function (id) {
		var d = document.getElementById(id);
		if (d) {
			__ensureDieCube(d);
			// Don't set inline transform: let the CSS default (-22, -32) show.
			__dieRot[d.id] = { x: -22, y: -32 };
		}
	});
	__setupDiceThrow();

	_injectAvatarPickers();
	_restoreSetupFromStorage();
	_initGameState();
	// Sprint Setup Item 2 — sync visual pickers from the canonical <select>
	// state AFTER restore. Otherwise restored values would show in the
	// hidden selects but the visual buttons would still highlight defaults.
	for (var __pi = 1; __pi <= 8; __pi++) {
		__syncVisualPickersFromSelects(__pi);
		__updatePlayerPreview(__pi);
	}

	UI.$on("playernumber", "change", playernumber_onchange);
	playernumber_onchange();

	_wireGlobalButtons();
	UI.$on("nextbutton", "click", game.next);

	UI.$hide("noscript");
	// setup uses flex column so .setup-section-my-20 can margin-top:auto
	// the Start button to the bottom of the card; UI.$show() would
	// clear the inline display and let CSS pick the default, but we want
	// to force flex here.
	document.getElementById('setup').style.display = 'flex';
	UI.$show("noF5");

	_initBoardCells();

	// Material ripple on every button click. Delegated at body level so it
	// covers buttons created later (popups, manage panel, etc.).
	document.body.addEventListener('mousedown', function (e) {
		var btn = e.target;
		if (!btn || btn.tagName !== 'INPUT' || btn.type !== 'button') return;
		__spawnRipple(btn, e);
	});

	// Mark the body as being in the setup phase so #sp-players / #sp-control
	// stay hidden until the game actually starts. setup() clears this.
	document.body.setAttribute('data-phase', 'setup');

	// Unified right-side panel: settings + players + turn/dice + tabs.
	// We move the topbar, money bar and control panel into one container
	// so the UI reads as a single module and frees up screen space (lets
	// us bump the base font for readability).
	(function () {
		var stage = document.getElementById('game-stage');
		if (!stage) return;
		var existing = document.getElementById('sidepanel');
		if (existing) return; // run only once

		// Right-side panel: Actions only (turn + dice + tabs). The settings
		// gear used to live inside an sp-header; it now stays in the fixed
		// #topbar at the viewport corner so it's reachable from every screen
		// (setup, in-game, victory) without us juggling DOM ownership.

		var panel = document.createElement('div');
		panel.id = 'sidepanel';

		// Control section: holds tabs + buy/manage + dice + roll button.
		var controlSection = document.createElement('div');
		controlSection.id = 'sp-control';
		var controlLabel = document.createElement('div');
		controlLabel.className = 'sp-section-label';
		controlLabel.setAttribute('data-i18n', 'panel.actionsLabel');
		controlLabel.textContent = 'Actions';
		controlSection.appendChild(controlLabel);
		panel.appendChild(controlSection);

		var control = document.getElementById('control');
		if (control) controlSection.appendChild(control);

		stage.appendChild(panel);

		// LEFT-side panel: roster of players. Sitting opposite the action
		// panel balances the layout — the old single-column right rail
		// crowded the right edge while the wood texture to the left of the
		// board sat empty. The two panels mirror each other now.
		var panelLeft = document.createElement('div');
		panelLeft.id = 'sidepanel-left';

		var playersSection = document.createElement('div');
		playersSection.id = 'sp-players';
		var playersLabel = document.createElement('div');
		playersLabel.className = 'sp-section-label';
		playersLabel.setAttribute('data-i18n', 'panel.playersLabel');
		playersLabel.textContent = 'Players';
		playersSection.appendChild(playersLabel);
		panelLeft.appendChild(playersSection);

		var moneybarwrap = document.getElementById('moneybarwrap');
		if (moneybarwrap) playersSection.appendChild(moneybarwrap);

		stage.appendChild(panelLeft);

		// Tag the dice-wrapping div with .dice-tray so CSS can style it.
		var die0 = document.getElementById('die0');
		if (die0 && die0.parentNode) die0.parentNode.classList.add('dice-tray');
		// Mirror current language on <body> so the lang-aware CSS pseudo
		// (e.g. .dice-tray::before) shows the right label.
		var langNow = (typeof I18N !== 'undefined' && I18N.get) ? I18N.get() : 'en';
		document.body.setAttribute('lang', langNow);
	})();

	// Center decks — two card piles in the middle of the board (classic
	// Monopoly layout). Labels are i18n-tagged so applyToDOM keeps them
	// in sync if the user toggles language mid-game.
	(function () {
		var board = document.getElementById('board');
		if (!board) return;

		// Logo in the dead center of the board.
		var logo = document.createElement('div');
		logo.id = 'board-logo';
		board.appendChild(logo);

		var ccDeck = document.createElement('div');
		ccDeck.id = 'deck-cc';
		ccDeck.className = 'center-deck';
		ccDeck.innerHTML =
			'<span class="center-deck-icon"></span>' +
			'<span data-i18n="source.cc">Community Chest</span>';
		board.appendChild(ccDeck);

		var chDeck = document.createElement('div');
		chDeck.id = 'deck-chance';
		chDeck.className = 'center-deck';
		chDeck.innerHTML =
			'<span class="center-deck-icon"></span>' +
			'<span data-i18n="source.chance">Chance</span>';
		board.appendChild(chDeck);

		// Localise immediately so the labels read in the current language
		// rather than the English fallback before any user action.
		if (typeof I18N !== 'undefined') I18N.applyToDOM();
	})();


	// Add images to enlarges.
	document.getElementById("enlarge0token").innerHTML += '<img src="images/arrow_icon.png" height="40" width="136" alt="" />';
	document.getElementById("enlarge20price").innerHTML += "<img src='images/free_parking_icon.png' height='80' width='72' alt='' style='position: relative; top: -20px;' />";
	document.getElementById("enlarge38token").innerHTML += '<img src="images/tax_icon.png" height="60" width="70" alt="" style="position: relative; top: -20px;" />';

	corrections();

	// Jail corrections
	var __jail = document.getElementById("jail");
	if (__jail) {
		var __jph = document.createElement("div");
		__jph.id = "jailpositionholder";
		__jail.appendChild(__jph);
		var __jspan = document.createElement("span");
		__jspan.textContent = t('place.jail');
		__jail.appendChild(__jspan);
	}

	document.getElementById("jail").enlargeId = "enlarge40";

	document.getElementById("enlarge-wrap").innerHTML += "<div id='enlarge40' class='enlarge'><div id='enlarge40color' class='enlarge-color'></div><br /><div id='enlarge40name' class='enlarge-name'></div><br /><div id='enlarge40price' class='enlarge-price'><img src='images/jake_icon.png' height='80' width='80' alt='' style='position: relative; top: -20px;' /></div><br /><div id='enlarge40token' class='enlarge-token'></div></div>";

	document.getElementById("enlarge40name").textContent = t('place.jail');

	_initDragHandlers();
	_wireManagePanel();
	_wireMoneyBarInteractivity();
	_wireTabSwitchers();
};

// Sprint 4 — PWA install banner.
// Captures beforeinstallprompt so the browser-native install UI can be
// surfaced from our own button (Chrome/Edge/Android Chrome only — other
// browsers ignore the event and the button simply stays hidden).
(function () {
	var deferredPrompt = null;

	window.addEventListener("beforeinstallprompt", function (e) {
		e.preventDefault();
		deferredPrompt = e;

		var btn = document.getElementById("pwa-install-btn");
		if (!btn) {
			return;
		}
		btn.style.display = "inline-block";

		btn.onclick = function () {
			if (!deferredPrompt) {
				return;
			}
			deferredPrompt.prompt();
			deferredPrompt.userChoice.then(function () {
				deferredPrompt = null;
				btn.style.display = "none";
			});
		};
	});

	window.addEventListener("appinstalled", function () {
		deferredPrompt = null;
		var btn = document.getElementById("pwa-install-btn");
		if (btn) {
			btn.style.display = "none";
		}
	});
})();
