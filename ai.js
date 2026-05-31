// ============================================================
//  AI players — Easy / Normal / Hard
//
//  Each level represents a distinct player archetype:
//
//    EASY   — "naive kid" : impulsive, ignores ROI, pays jail
//             instantly, builds randomly, often gives bad trades.
//    NORMAL — "casual"     : understands group value, builds
//             evenly, occasionally trades, plays safe with cash.
//    HARD   — "strategist" : aggressive monopoly hunter,
//             blocks opponents, applies 3-house shortage,
//             counter-offers smartly, late-game aware.
//
//  All three share the same interface (engine contract):
//    buyProperty(index)        → bool: buy now?
//    acceptTrade(tradeObj)     → bool | Trade: accept / counter / reject
//    beforeTurn()              → bool: true iff a trade was proposed
//    onLand()                  → bool: true iff a trade was proposed
//    postBail()                → bool: pay $50 / use jail card?
//    payDebt()                 → void: sell/mortgage until money >= 0
//    bid(propIdx, currentBid)  → -1 exit | 0 pass | positive bid
//
//  All internal helpers are wrapped in an IIFE so only AIEasy /
//  AINormal / AIHard / AITest leak to the global scope. monopoly.js
//  reads .count on each (e.g. AIEasy.count) and uses them as
//  constructors — both still work because they're the same function
//  objects, just exposed via window.* at the end.
// ============================================================

(function () {

// ------------------------------------------------------------
// Shared strategic data
// ------------------------------------------------------------

// Strategic value per color group. Higher = better ROI / more traffic.
// Based on Monte Carlo analysis of board landings (post-jail bias).
var __AI_GROUP_VALUE = {
	1: 7,   // railroads — strong if all 4 owned
	2: 4,   // utilities — weak unless lucky dice
	3: 4,   // brown — cheap to build, but low traffic
	4: 5,   // light blue
	5: 6,   // pink
	6: 9,   // orange  — BEST ROI (most landings after jail)
	7: 8,   // red
	8: 8,   // yellow
	9: 7,   // green   — expensive houses
	10: 7   // blue    — high rent, very few landings
};

function __aiGroupSize(g) {
	if (g === 1) return 4;
	if (g === 2 || g === 3 || g === 10) return 2;
	return 3;
}

function __aiOwnedInGroup(playerIdx, g) {
	var n = 0;
	for (var i = 0; i < 40; i++) {
		if (square[i].groupNumber === g && square[i].owner === playerIdx) n++;
	}
	return n;
}

function __aiOwnsGroup(playerIdx, g) {
	return g && __aiOwnedInGroup(playerIdx, g) === __aiGroupSize(g);
}

function __aiCompletesGroup(playerIdx, propIdx) {
	var g = square[propIdx].groupNumber;
	if (!g) return false;
	return __aiOwnedInGroup(playerIdx, g) === __aiGroupSize(g) - 1;
}

function __aiOwnedCount(playerIdx) {
	var n = 0;
	for (var i = 0; i < 40; i++) if (square[i].owner === playerIdx) n++;
	return n;
}

// True if accepting this trade would complete a monopoly for the recipient.
// Includes railroads (g=1) and utilities (g=2) so the AI also recognises
// completing those sets as a meaningful payoff.
function __aiTradeCompletesGroup(recipientIdx, tradeProp) {
	for (var g = 1; g <= 10; g++) {
		var owned = __aiOwnedInGroup(recipientIdx, g);
		var incoming = 0;
		for (var i = 0; i < 40; i++) {
			if (square[i].groupNumber === g && tradeProp[i] === 1) incoming++;
			if (square[i].groupNumber === g && tradeProp[i] === -1) owned--;
		}
		if (owned + incoming === __aiGroupSize(g)) return true;
	}
	return false;
}

// True if accepting this trade would complete a monopoly for the initiator
// (i.e. the receiver should weigh the strategic cost of enabling them).
//
// Trade-prop convention is FROM THE RECIPIENT's perspective:
//   tradeProp[i] === 1  → recipient receives  → initiator gives away (-1 net)
//   tradeProp[i] === -1 → recipient gives away → initiator receives  (+1 net)
function __aiTradeGivesOpponentMonopoly(initiatorIdx, tradeProp) {
	for (var g = 1; g <= 10; g++) {
		var net = __aiOwnedInGroup(initiatorIdx, g);
		for (var i = 0; i < 40; i++) {
			if (square[i].groupNumber !== g) continue;
			if (tradeProp[i] === -1) net++;   // initiator receives
			else if (tradeProp[i] === 1) net--; // initiator gives away
		}
		if (net === __aiGroupSize(g)) return true;
	}
	return false;
}

// Returns the highest single-cell rent any opponent currently threatens.
// Used by Hard to decide whether to stay in jail (rent danger).
function __aiMaxOpponentRent(playerIdx) {
	// Railroad rent scales 25/50/100/200 by owner's count; utilities use a
	// dice multiplier (~7 avg) of 4× or 10× by owner's count. Compute counts
	// per opponent once.
	var rrCount = {}, utilCount = {};
	for (var j = 0; j < 40; j++) {
		var sj = square[j];
		if (sj.owner === 0 || sj.owner === playerIdx || sj.mortgage) continue;
		if (sj.groupNumber === 1) rrCount[sj.owner] = (rrCount[sj.owner] || 0) + 1;
		else if (sj.groupNumber === 2) utilCount[sj.owner] = (utilCount[sj.owner] || 0) + 1;
	}
	var max = 0;
	for (var i = 0; i < 40; i++) {
		var s = square[i];
		if (s.owner === 0 || s.owner === playerIdx) continue;
		if (s.mortgage) continue;
		var rent;
		if (s.groupNumber === 1) {
			rent = 25 * Math.pow(2, (rrCount[s.owner] || 1) - 1);
		} else if (s.groupNumber === 2) {
			rent = (utilCount[s.owner] === 2 ? 10 : 4) * 7;
		} else if (s.hotel) rent = s.rent5 || 0;
		else if (s.house >= 1) {
			var rk = ['rent1', 'rent2', 'rent3', 'rent4'][s.house - 1];
			rent = s[rk] || 0;
		} else {
			rent = s.baserent || 0;
			if (__aiOwnsGroup(s.owner, s.groupNumber)) rent *= 2;
		}
		if (rent > max) max = rent;
	}
	return max;
}

// How many players are still in the game with > 0 properties / cash.
function __aiActivePlayerCount() {
	if (typeof pcount === 'undefined') return 1;
	return pcount;
}

// How many full monopolies a player owns.
function __aiMonopolyCount(playerIdx) {
	var n = 0;
	for (var g = 1; g <= 10; g++) if (__aiOwnsGroup(playerIdx, g)) n++;
	return n;
}

// Total liquid value the player could raise NOW (cash + mortgage value of
// unmortgaged props + half-price of every house). Used for cash-stress checks.
function __aiLiquidity(playerIdx) {
	if (!player[playerIdx]) return 0;
	var liq = player[playerIdx].money;
	for (var i = 0; i < 40; i++) {
		var sq = square[i];
		if (sq.owner !== playerIdx) continue;
		if (!sq.mortgage && sq.house === 0 && !sq.hotel) liq += Math.round(sq.price * 0.5);
		if (sq.house > 0) liq += sq.house * Math.round((sq.houseprice || 0) * 0.5);
		if (sq.hotel)     liq += 5 * Math.round((sq.houseprice || 0) * 0.5);
	}
	return liq;
}

// Properties this player owns that are NOT in a monopoly of theirs — these
// are "loose" assets safe to trade away or mortgage first.
function __aiLooseProps(playerIdx) {
	var out = [];
	for (var i = 0; i < 40; i++) {
		var sq = square[i];
		if (sq.owner !== playerIdx) continue;
		if (sq.groupNumber === 1 || sq.groupNumber === 2) continue; // railroads/utilities
		if (__aiOwnsGroup(playerIdx, sq.groupNumber)) continue;
		out.push(i);
	}
	return out;
}


// ============================================================
//  EASY — "naive kid"
//
//  Plays the basic Monopoly motions but with poor judgement:
//   • Buys most things impulsively (no reserve check).
//   • Builds randomly on monopolies (no ROI awareness).
//   • Always pays jail fine, doesn't strategize about it.
//   • Accepts roughly half of trades regardless of value.
//   • Sells/mortgages randomly when broke.
//   • Bids timidly in auctions.
// ============================================================
var AI_NAME_POOL = {
	es: [
		"Armando Bronca Segura", "Luz Cuesta Mogollón", "Ana Mier de Cilla",
		"Dolores Fuertes de Barriga", "Elvio Lado Oscuro", "Debora Melo",
		"Benito Camelo", "Paco Jones", "Elba Lazo", "Alan Brito Delgado",
		"Aquiles Bailo", "Rosa Melano", "Jorge Nitales", "Esteban Dido",
		"Elsa Pato", "Lola Mento", "Armando Paredes", "Susana Horia",
		"Zoila Vaca", "Paco Merlo"
	],
	en: [
		"Paige Turner", "Justin Case", "Anita Bath", "Robin Banks",
		"Barb Dwyer", "Chris P. Bacon", "Sal Monella", "Barry Cade",
		"Phil A. Mignon", "Al Beback", "Bill Board", "Terry Cloth",
		"Candy Barr", "Otto Graph", "Barb Wire", "Will Power",
		"Dan D. Lyon", "Holly Wood", "Ben Dover", "Sue Flay"
	]
};
function __pickAIName() {
	var locale = (typeof I18N !== 'undefined' && typeof I18N.get === 'function') ? I18N.get() : 'en';
	var pool = AI_NAME_POOL[locale] || AI_NAME_POOL.en;
	var used = {};
	for (var i = 1; i < player.length; i++) { if (player[i] && player[i].name) used[player[i].name] = true; }
	var avail = [];
	for (var j = 0; j < pool.length; j++) { if (!used[pool[j]]) avail.push(pool[j]); }
	if (avail.length === 0) avail = pool;
	return avail[Math.floor(Math.random() * avail.length)];
}

function AIEasy(p) {
	this.alertList = "";
	this.constructor.count++;
	p.name = __pickAIName();

	this.buyProperty = function (index) {
		var s = square[index];
		if (s.price === 0) return false;
		if (p.money < s.price + 30) return false;    // tiny safety net
		// Impulsive: 70% chance to buy, 100% if completes a group.
		if (__aiCompletesGroup(p.index, index)) return true;
		// Mild defensive instinct (still naïve): if an opponent owns N-1 of
		// this group, sniping it for ~free is too tempting to pass up.
		var g = s.groupNumber;
		if (g >= 3) {
			for (var pp = 1; pp <= pcount; pp++) {
				if (pp === p.index) continue;
				if (__aiOwnedInGroup(pp, g) === __aiGroupSize(g) - 1 && p.money >= s.price + 40) return true;
			}
		}
		return Math.random() > 0.30;
	};

	this.acceptTrade = function (tradeObj) {
		// Naive: mostly looks at money + rough property value.
		var money = tradeObj.getMoney();
		var initiator = tradeObj.getInitiator();
		var prop = [];
		var roughValue = money;
		for (var i = 0; i < 40; i++) {
			var sign = tradeObj.getProperty(i);
			prop[i] = sign;
			if (sign) roughValue += sign * square[i].price * 0.4;
		}
		// Newly-learned rule: don't gift a monopoly. Even a "kid" notices
		// after losing once. Refuse unless overcompensated by a lot.
		if (__aiTradeGivesOpponentMonopoly(initiator.index, prop) && roughValue < 200) {
			return false;
		}
		// Slightly biased toward accepting (kids love trading cards).
		if (roughValue > -100 && Math.random() > 0.35) return true;
		return false;
	};

	this.beforeTurn = function () {
		// Random building on owned monopolies — only when comfortable cash.
		// No ROI consideration: picks any lot in any owned group.
		if (p.money < 250) return false;
		var candidates = [];
		for (var i = 0; i < 40; i++) {
			var s = square[i];
			if (s.owner !== p.index || s.groupNumber < 3) continue;
			if (!__aiOwnsGroup(p.index, s.groupNumber)) continue;
			if (s.mortgage || s.house >= 5) continue;
			// Even-build constraint: must equal the min house count in the group.
			var minH = 5;
			for (var j = 0; j < s.group.length; j++) {
				var g = square[s.group[j]];
				if (g.mortgage) continue;
				if (g.house < minH) minH = g.house;
			}
			if (s.house === minH) candidates.push(i);
		}
		// Buy ONE house on a random eligible lot per turn. Bump the cash
		// floor to $150 so we don't auto-bankrupt on the very next rent hit.
		if (candidates.length > 0) {
			var pick = candidates[Math.floor(Math.random() * candidates.length)];
			if (p.money > square[pick].houseprice + 150) buyHouse(pick);
		}
		return false;
	};

	this.onLand = function () { return false; };

	this.postBail = function () {
		// Impatient: always wants out immediately. Engine auto-prefers the
		// jail card over $50 when one is available.
		return true;
	};

	this.payDebt = function () {
		// Slightly less panicked: mortgage LOOSE props (not part of any
		// monopoly) before touching grouped ones. Easy still doesn't sort
		// by price/ROI — just preserves what little structure it has.
		var loose = __aiLooseProps(p.index);
		loose.sort(function () { return Math.random() - 0.5; });
		for (var k = 0; k < loose.length && p.money < 0; k++) {
			if (!square[loose[k]].mortgage && square[loose[k]].house === 0) mortgage(loose[k]);
		}
		// Then random eligible properties (any group).
		var owned = [];
		for (var i = 0; i < 40; i++) {
			var sq = square[i];
			if (sq.owner === p.index && !sq.mortgage && sq.house === 0) owned.push(i);
		}
		owned.sort(function () { return Math.random() - 0.5; });
		for (var k = 0; k < owned.length && p.money < 0; k++) mortgage(owned[k]);

		// If still in debt, sell houses one by one (also randomly).
		var safety = 30;
		while (p.money < 0 && safety-- > 0) {
			var soldAny = false;
			var houseIdxs = [];
			for (var i = 0; i < 40; i++) {
				if (square[i].owner === p.index && square[i].house > 0) houseIdxs.push(i);
			}
			houseIdxs.sort(function () { return Math.random() - 0.5; });
			for (var k = 0; k < houseIdxs.length && p.money < 0; k++) {
				if (sellHouse(houseIdxs[k])) soldAny = true;
			}
			if (!soldAny) break;
		}
		// Final pass: properties that just had their houses sold are now eligible
		// to mortgage. Without this, Easy can enter bankruptcy holding unmortgaged
		// equity it could have liquidated.
		for (var i = 0; i < 40 && p.money < 0; i++) {
			var s = square[i];
			if (s.owner === p.index && !s.mortgage && s.house === 0) mortgage(i);
		}
	};

	this.bid = function (property, currentBid) {
		var s = square[property];
		// Easy is hesitant — small increments, exits at ~80% of price.
		var bid = currentBid + 10;
		if (bid > s.price * 0.8) return -1;
		if (bid > p.money * 0.4) return -1;
		if (bid >= p.money) return -1;
		return bid;
	};
}
AIEasy.count = 0;


// ============================================================
//  NORMAL — "casual player"
//
//  Knows the basics, plays safe:
//   • Reserve-aware buying (won't bankrupt itself for one property).
//   • Builds evenly across owned monopolies.
//   • Trades only when math clearly favors them.
//   • Stays in jail late game for safety.
//   • Mortgages cheap stuff first when paying debt.
//   • Bids reasonably up to slightly over price.
// ============================================================
function AINormal(p) {
	this.alertList = "";
	this.constructor.count++;
	p.name = __pickAIName();

	// Cash reserve scales with game state AND the current rent danger.
	function reserve() {
		var base = 80;
		base += __aiOwnedCount(p.index) * 15;
		// If an opponent threatens a heavy rent, keep more liquidity.
		var threat = __aiMaxOpponentRent(p.index);
		if (threat > 200) base += Math.min(150, Math.round((threat - 200) * 0.3));
		return base;
	}

	this.buyProperty = function (index) {
		var s = square[index];
		if (s.price === 0 || p.money < s.price) return false;
		// Always buy a monopoly-completer if affordable.
		if (__aiCompletesGroup(p.index, index)) return p.money >= s.price + 20;
		// Defensive block: snipe a property that would complete an opponent's
		// monopoly. Casual players notice this kind of threat.
		var g = s.groupNumber;
		if (g >= 3) {
			for (var pp = 1; pp <= pcount; pp++) {
				if (pp === p.index) continue;
				if (__aiOwnedInGroup(pp, g) === __aiGroupSize(g) - 1 && p.money >= s.price + 30) return true;
			}
		}
		// Otherwise, respect the cash reserve.
		var gv = __AI_GROUP_VALUE[g] || 5;
		var rsv = reserve();
		if (gv >= 7) rsv -= 20;     // slightly more eager on high-ROI
		if (gv <= 4) rsv += 30;     // wary of low-ROI (utilities, browns)
		return p.money > s.price + rsv;
	};

	this.acceptTrade = function (tradeObj) {
		var tradeValue = 0;
		var money = tradeObj.getMoney();
		var initiator = tradeObj.getInitiator();
		var recipient = tradeObj.getRecipient();
		var prop = [];

		tradeValue += 12 * tradeObj.getCommunityChestJailCard();
		tradeValue += 12 * tradeObj.getChanceJailCard();
		tradeValue += money;

		for (var i = 0; i < 40; i++) {
			prop[i] = tradeObj.getProperty(i);
			if (!prop[i]) continue;
			var sq = square[i];
			var v = sq.price * (sq.mortgage ? 0.55 : 1);
			// Slight group-value adjustment.
			v *= (__AI_GROUP_VALUE[sq.groupNumber] || 5) / 5;
			// Recipient gains a monopoly → big bonus.
			if (prop[i] === 1 && __aiCompletesGroup(p.index, i)) v += sq.price * 0.6;
			tradeValue += prop[i] * v;
		}

		// Strategic consideration (low intensity): avoid giving opponent a
		// monopoly unless they're paying way over value.
		if (__aiTradeGivesOpponentMonopoly(initiator.index, prop) && tradeValue < 100) {
			return false;
		}

		if (tradeValue > 30) return true;
		// One counter-offer if close to fair.
		if (tradeValue >= -60 && initiator.money > Math.abs(tradeValue) + 30) {
			var counterMoney = money + Math.max(20, 40 - Math.round(tradeValue));
			return new Trade(initiator, recipient, counterMoney, prop,
				tradeObj.getCommunityChestJailCard(), tradeObj.getChanceJailCard());
		}
		return false;
	};

	this.beforeTurn = function () {
		// Build on owned groups in ROI order — orange/red/yellow first, browns last.
		var roiOrder = [6, 7, 8, 9, 10, 5, 4, 3];
		for (var pi = 0; pi < roiOrder.length; pi++) {
			var groupNum = roiOrder[pi];
			if (!__aiOwnsGroup(p.index, groupNum)) continue;

			// Even-build: find the lot with the fewest houses in the group.
			var leastIdx = -1, leastH = 6, blocked = false, groupLots = null;
			for (var i = 0; i < 40; i++) {
				if (square[i].groupNumber !== groupNum || square[i].owner !== p.index) continue;
				if (!groupLots) groupLots = square[i].group;
				if (square[i].mortgage) { blocked = true; break; }
				if (square[i].house < leastH) { leastH = square[i].house; leastIdx = i; }
			}
			if (!blocked && leastIdx >= 0 && leastH < 5 &&
			    p.money > square[leastIdx].houseprice + 100) {
				buyHouse(leastIdx);
			}
		}
		// Unmortgage when comfortable (200+ surplus over cost).
		for (var i = 39; i >= 0; i--) {
			var s = square[i];
			if (s.owner === p.index && s.mortgage &&
			    p.money > Math.round(s.price * 0.55) + 200) {
				unmortgage(i);
			}
		}
		return false;
	};

	var utilityForRailroadFlag = true; // pitch only once per game
	var pitchedTo = {};                 // recipient idx → true (one pitch per opp)
	this.onLand = function () {
		if (game.getDie(1) === game.getDie(2)) return false;

		// Pitch 1: trade a property we own for one that completes a group of ours.
		// Looks for groups where we own N-1; finds the missing piece's owner
		// and offers any spare unimproved property + small cash.
		for (var myG = 3; myG <= 10; myG++) {
			var owned = __aiOwnedInGroup(p.index, myG);
			if (owned === 0 || owned !== __aiGroupSize(myG) - 1) continue;
			var missing = -1, ownerIdx = -1;
			for (var i = 0; i < 40; i++) {
				if (square[i].groupNumber === myG && square[i].owner !== p.index && square[i].owner !== 0) {
					missing = i; ownerIdx = square[i].owner; break;
				}
			}
			if (missing < 0 || pitchedTo[ownerIdx]) continue;
			// Find a spare unimproved property we can give away (not part of a monopoly).
			var offering = -1;
			for (var i = 0; i < 40; i++) {
				var sq = square[i];
				if (sq.owner !== p.index || sq.house > 0 || sq.mortgage) continue;
				if (sq.groupNumber === 1 || sq.groupNumber === 2) continue;
				if (__aiOwnsGroup(p.index, sq.groupNumber)) continue;
				offering = i; break;
			}
			if (offering < 0) continue;
			var prop = new Array(40).fill(0);
			prop[missing] = -1;
			prop[offering] = 1;
			var diff = square[missing].price - square[offering].price;
			var cash = Math.max(0, Math.round(diff * 0.5));
			if (cash > p.money - reserve()) cash = Math.max(0, p.money - reserve());
			pitchedTo[ownerIdx] = true;
			game.trade(new Trade(p, player[ownerIdx], cash, prop, 0, 0));
			return true;
		}

		// Pitch 2 (legacy): utility-for-railroad swap, once per game.
		if (!utilityForRailroadFlag) return false;
		var prop2 = new Array(40).fill(0);
		var requestedRailroad = null;
		var offeredUtility = null;
		var rails = [5, 15, 25, 35];
		for (var i = 0; i < 4; i++) {
			var s = square[rails[i]];
			if (s.owner !== 0 && s.owner !== p.index) { requestedRailroad = rails[i]; break; }
		}
		if (square[12].owner === p.index && square[28].owner !== p.index)      offeredUtility = 12;
		else if (square[28].owner === p.index && square[12].owner !== p.index) offeredUtility = 28;
		if (requestedRailroad && offeredUtility) {
			utilityForRailroadFlag = false;
			prop2[requestedRailroad] = -1;
			prop2[offeredUtility] = 1;
			game.trade(new Trade(p, player[square[requestedRailroad].owner], 0, prop2, 0, 0));
			return true;
		}
		return false;
	};

	this.postBail = function () {
		// Stay in jail when the board is dangerous: high rent threat AND
		// either a jail card or healthy cash. Last roll always pays out.
		if (p.jailroll === 2) return true;
		var threat = __aiMaxOpponentRent(p.index);
		var ownedLate = __aiOwnedCount(p.index) >= 4;
		if (threat >= 150 && ownedLate) {
			// Stay unless burning the $50 bail is the only way out.
			return false;
		}
		return true;
	};

	this.payDebt = function () {
		// 1. Mortgage cheapest-first.
		var props = [];
		for (var i = 0; i < 40; i++) {
			if (square[i].owner === p.index && !square[i].mortgage && square[i].house === 0) props.push(i);
		}
		props.sort(function (a, b) { return square[a].price - square[b].price; });
		for (var k = 0; k < props.length && p.money < 0; k++) mortgage(props[k]);

		// 2. Sell houses if still short (iteratively, even-sell constraint).
		var safety = 50;
		while (p.money < 0 && safety-- > 0) {
			var soldAny = false;
			for (var i = 0; i < 40 && p.money < 0; i++) {
				if (square[i].owner === p.index && square[i].house > 0 && sellHouse(i)) {
					soldAny = true;
				}
			}
			if (!soldAny) break;
		}
		// 3. Final pass after houses gone.
		for (var i = 0; i < 40 && p.money < 0; i++) {
			var s = square[i];
			if (s.owner === p.index && !s.mortgage && s.house === 0) mortgage(i);
		}
	};

	this.bid = function (property, currentBid) {
		var s = square[property];
		var ceiling = s.price * 1.1;
		if (__aiCompletesGroup(p.index, property)) ceiling = s.price * 1.6;
		// Defensive bid: outbid when an opponent is one short of completing this group.
		for (var pp = 1; pp <= pcount; pp++) {
			if (pp === p.index) continue;
			if (__aiOwnedInGroup(pp, s.groupNumber) === __aiGroupSize(s.groupNumber) - 1) {
				ceiling = Math.max(ceiling, s.price * 1.3);
				break;
			}
		}
		var bid = currentBid + Math.round(15 + Math.random() * 20);
		if (bid > ceiling) return -1;
		if (bid + reserve() > p.money) return -1;
		return bid;
	};
}
AINormal.count = 0;

// Backward-compat alias for callers that still reference AITest.
var AITest = AINormal;


// ============================================================
//  HARD — "strategist"
//
//  Plays Monopoly the way a competitive player would:
//   • Knows group ROI deeply, prioritizes orange/red/yellow.
//   • REFUSES trades that complete an opponent's monopoly.
//   • Applies the 3-house shortage when 4+ players (real Monopoly
//     pro move: stop at 3 houses on each lot of a group so the
//     bank's 32-house pool stays exhausted, blocking opponents).
//   • Stays in jail late game when rent danger is high.
//   • Pitches trades on properties it needs AND offers what the
//     opponent needs as bait.
//   • Defensive bidding: outbids opponents on properties that
//     would complete their monopoly, even at a loss.
//   • Sells houses on the worst group first, mortgages cheap.
// ============================================================
function AIHard(p) {
	this.alertList = "";
	this.constructor.count++;
	p.name = __pickAIName();

	// Dynamic reserve based on biggest rent danger AND own monopoly count
	// (more monopolies = more construction obligations).
	function reserve() {
		var owned = __aiOwnedCount(p.index);
		var monos = __aiMonopolyCount(p.index);
		var maxRent = __aiMaxOpponentRent(p.index);
		var base = 100 + owned * 25 + monos * 40;
		return Math.max(base, Math.round(maxRent * 0.8));
	}

	this.buyProperty = function (index) {
		var s = square[index];
		if (s.price === 0 || p.money < s.price) return false;

		// Always buy a monopoly-completer.
		if (__aiCompletesGroup(p.index, index)) return true;

		var g = s.groupNumber;

		// DEFENSIVE LV1: snipe if not buying lets an opponent complete their group.
		if (g >= 3) {
			for (var pp = 1; pp <= pcount; pp++) {
				if (pp === p.index) continue;
				if (__aiOwnedInGroup(pp, g) === __aiGroupSize(g) - 1) {
					if (p.money >= s.price + 50) return true;
				}
			}
		}

		// DEFENSIVE LV2 (anti-stripe): if an opponent already owns 1+ in this
		// group AND we own none, buying this property OURSELVES breaks their
		// monopoly chance. Worth it on high-ROI groups when comfortable on cash.
		if (g >= 3 && __aiOwnedInGroup(p.index, g) === 0) {
			for (var pp = 1; pp <= pcount; pp++) {
				if (pp === p.index) continue;
				if (__aiOwnedInGroup(pp, g) >= 1) {
					var gvDef = __AI_GROUP_VALUE[g] || 5;
					if (gvDef >= 7 && p.money >= s.price + reserve() + 60) return true;
				}
			}
		}

		var rsv = reserve();
		var gv = __AI_GROUP_VALUE[g] || 5;
		if (gv >= 8) rsv -= 60;   // pay more for top ROI groups
		if (gv <= 4) rsv += 50;   // wary of low-ROI
		// Snipe high-ROI when we own one of the group (working toward monopoly).
		if (gv >= 8 && __aiOwnedInGroup(p.index, g) >= 1) rsv -= 40;
		return p.money > s.price + rsv;
	};

	this.acceptTrade = function (tradeObj) {
		var money = tradeObj.getMoney();
		var initiator = tradeObj.getInitiator();
		var recipient = tradeObj.getRecipient();
		var prop = [];
		var tradeValue = money;

		tradeValue += 15 * tradeObj.getCommunityChestJailCard();
		tradeValue += 15 * tradeObj.getChanceJailCard();

		for (var i = 0; i < 40; i++) {
			prop[i] = tradeObj.getProperty(i);
			if (!prop[i]) continue;
			var sq = square[i];
			var v = sq.price * (sq.mortgage ? 0.55 : 1);
			v *= (__AI_GROUP_VALUE[sq.groupNumber] || 5) / 5;
			if (prop[i] === 1 && __aiCompletesGroup(p.index, i))             v += sq.price * 1.0;
			if (prop[i] === -1 && __aiCompletesGroup(initiator.index, i))   v -= sq.price * 0.8;
			tradeValue += prop[i] * v;
		}

		// HARD REFUSAL: if this trade hands the initiator a monopoly, only
		// accept if obscenely overcompensated.
		if (__aiTradeGivesOpponentMonopoly(initiator.index, prop) && tradeValue < 300) {
			return false;
		}

		if (tradeValue > 100) return true;

		// Counter offer for a fair-ish trade.
		if (tradeValue > -150 && initiator.money > Math.abs(tradeValue) + 80) {
			var counterMoney = money + Math.max(50, 120 - Math.round(tradeValue));
			return new Trade(initiator, recipient, counterMoney, prop,
				tradeObj.getCommunityChestJailCard(), tradeObj.getChanceJailCard());
		}
		return false;
	};

	this.beforeTurn = function () {
		var activePlayers = __aiActivePlayerCount();
		var multiplayer = activePlayers >= 4;
		// Endgame heuristic: two players left → all-in on hotels to crush the
		// other side with rent. The house-shortage trick is moot 1-on-1.
		var endgame = activePlayers === 2;

		// Build on owned groups, prioritizing by ROI.
		var prio = [6, 7, 8, 9, 10, 5, 4, 3];
		for (var pi = 0; pi < prio.length; pi++) {
			var g = prio[pi];
			if (!__aiOwnsGroup(p.index, g)) continue;

			// House cap rules:
			//  - 2-player endgame: always go to hotels (cap 5) — maximum rent.
			//  - 4+ players & cash < 1500: cap at 3 to exploit the bank's
			//    32-house pool shortage (opponents can't build).
			//  - Otherwise: full hotels.
			var houseCap = 5;
			if (multiplayer && p.money < 1500 && !endgame) houseCap = 3;

			while (true) {
				var leastIdx = -1, leastH = 6, blocked = false;
				for (var i = 0; i < 40; i++) {
					if (square[i].groupNumber !== g || square[i].owner !== p.index) continue;
					if (square[i].mortgage) { blocked = true; break; }
					if (square[i].house < leastH) { leastH = square[i].house; leastIdx = i; }
				}
				if (blocked || leastIdx < 0 || leastH >= houseCap) break;
				// Endgame: spend down to a thinner reserve to fund hotels fast.
				var rsv = endgame ? Math.max(80, reserve() - 200) : reserve();
				if (p.money < square[leastIdx].houseprice + rsv) break;
				buyHouse(leastIdx);
			}
		}

		// Unmortgage: group-owned lots first.
		for (var i = 0; i < 40; i++) {
			var s = square[i];
			if (s.owner !== p.index || !s.mortgage) continue;
			if (!__aiOwnsGroup(p.index, s.groupNumber)) continue;
			if (p.money > Math.round(s.price * 0.55) + reserve()) unmortgage(i);
		}
		// Then loose lots if very cash-comfortable.
		for (var i = 0; i < 40; i++) {
			var s = square[i];
			if (s.owner === p.index && s.mortgage &&
			    p.money > Math.round(s.price * 0.55) + reserve() + 200) {
				unmortgage(i);
			}
		}
		return false;
	};

	var pitchedTradeTo = {}; // recipient idx → true (don't spam same player)

	this.onLand = function () {
		// Order candidate groups by ROI so the most valuable pitch fires first.
		var pitchOrder = [6, 7, 8, 1, 9, 10, 5, 4, 3, 2];
		for (var pi = 0; pi < pitchOrder.length; pi++) {
			var myG = pitchOrder[pi];
			var mine = __aiOwnedInGroup(p.index, myG);
			if (mine === 0 || mine === __aiGroupSize(myG)) continue;
			if (__aiGroupSize(myG) - mine !== 1) continue;

			var missing = -1, ownerIdx = -1;
			for (var i = 0; i < 40; i++) {
				if (square[i].groupNumber === myG && square[i].owner !== p.index && square[i].owner !== 0) {
					missing = i; ownerIdx = square[i].owner; break;
				}
			}
			if (missing < 0 || ownerIdx === 0 || ownerIdx === p.index) continue;
			if (pitchedTradeTo[ownerIdx]) continue;

			// Try first to sweeten with a property that COMPLETES the opponent's group.
			// Fall back to any spare unimproved property if none qualifies (still useful
			// as a small bribe — Hard now refuses to be limited to perfect-sweetener pitches).
			var offering = -1;
			for (var theirG = 1; theirG <= 10; theirG++) {
				if (__aiOwnedInGroup(ownerIdx, theirG) !== __aiGroupSize(theirG) - 1) continue;
				for (var i = 0; i < 40; i++) {
					if (square[i].groupNumber === theirG && square[i].owner === p.index &&
					    square[i].house === 0 && square[i].hotel === 0 && !square[i].mortgage) {
						offering = i; break;
					}
				}
				if (offering >= 0) break;
			}
			if (offering < 0) {
				// Fallback: any spare property we own that's NOT part of a monopoly of ours.
				for (var i = 0; i < 40; i++) {
					var sq = square[i];
					if (sq.owner !== p.index || sq.house > 0 || sq.hotel > 0 || sq.mortgage) continue;
					if (__aiOwnsGroup(p.index, sq.groupNumber)) continue;
					offering = i; break;
				}
			}

			var prop = new Array(40).fill(0);
			prop[missing] = -1;
			if (offering >= 0) prop[offering] = 1;
			// Cash sweetener: 60% of the value gap (or full price if we have no
			// property to offer). Capped to keep our reserve intact.
			var priceGap = square[missing].price - (offering >= 0 ? square[offering].price : 0);
			var cash = Math.max(0, Math.round(priceGap * 0.6));
			if (offering < 0) cash = Math.max(cash, Math.round(square[missing].price * 0.7));
			if (cash > p.money - reserve()) cash = Math.max(0, p.money - reserve());
			// Don't pitch a deal we literally can't afford.
			if (cash === 0 && offering < 0) continue;
			pitchedTradeTo[ownerIdx] = true;
			game.trade(new Trade(p, player[ownerIdx], cash, prop, 0, 0));
			return true;
		}
		return false;
	};

	this.postBail = function () {
		// Late-game with built-up opponents → stay in jail to avoid rent hits.
		var maxRent = __aiMaxOpponentRent(p.index);
		var dangerous = maxRent >= 200;
		var lateGame = __aiOwnedCount(p.index) >= 4;

		if (dangerous && lateGame) {
			// Burn the 3 free turns then pay (or use card if we have one).
			if (p.jailroll < 2) return false;
			return p.communityChestJailCard || p.chanceJailCard || p.money > 100;
		}
		// Early game: keep moving to acquire property.
		return true;
	};

	this.payDebt = function () {
		// 1. Sell houses on the LOWEST-ROI groups first to preserve top ones.
		var groupOrder = [2, 3, 4, 5, 9, 10, 1, 8, 7, 6]; // worst → best
		for (var gi = 0; gi < groupOrder.length && p.money < 0; gi++) {
			var g = groupOrder[gi];
			var safety = 30;
			while (p.money < 0 && safety-- > 0) {
				var soldAny = false;
				for (var i = 0; i < 40 && p.money < 0; i++) {
					if (square[i].groupNumber === g && square[i].owner === p.index
					    && square[i].house > 0 && sellHouse(i)) {
						soldAny = true;
					}
				}
				if (!soldAny) break;
			}
		}
		// 2. Mortgage cheapest, non-grouped first to preserve monopolies.
		var props = [];
		for (var i = 0; i < 40; i++) {
			if (square[i].owner !== p.index || square[i].mortgage || square[i].house > 0) continue;
			var penalty = __aiOwnsGroup(p.index, square[i].groupNumber) ? 1000 : 0;
			props.push({ idx: i, sortKey: square[i].price + penalty });
		}
		props.sort(function (a, b) { return a.sortKey - b.sortKey; });
		for (var k = 0; k < props.length && p.money < 0; k++) mortgage(props[k].idx);
	};

	this.bid = function (property, currentBid) {
		var s = square[property];
		var cap = s.price * 1.3;
		if (__aiCompletesGroup(p.index, property)) cap = s.price * 2.2;
		var blockBid = false;
		for (var pp = 1; pp <= pcount; pp++) {
			if (pp === p.index) continue;
			if (__aiOwnedInGroup(pp, s.groupNumber) === __aiGroupSize(s.groupNumber) - 1) {
				blockBid = true;
				cap = Math.max(cap, s.price * 1.5);
			}
		}
		var gv = __AI_GROUP_VALUE[s.groupNumber] || 5;
		if (gv >= 8) cap *= 1.2;

		// Stepped increment: chunky bumps while well below cap, tiny bumps
		// near the ceiling so we don't overshoot.
		var headroom = cap - currentBid;
		var increment;
		if (headroom > cap * 0.4)      increment = blockBid ? 30 + Math.random() * 50 : 20 + Math.random() * 30;
		else if (headroom > cap * 0.15) increment = blockBid ? 15 + Math.random() * 25 : 10 + Math.random() * 15;
		else                            increment = blockBid ? 5  + Math.random() * 10 : 3  + Math.random() * 7;
		var bid = currentBid + Math.round(increment);
		if (bid > cap) return -1;
		// Never bid past liquidity safety: keep reserve + 60.
		if (bid + reserve() + 60 > p.money) return -1;
		return bid;
	};
}
AIHard.count = 0;

// ============================================================
//  ADAPTIVE — dynamic difficulty (v2)
//
//  Scores the human's relative dominance against a composite signal:
//
//    score = 0.55·netWorthRatio + 0.25·monopolyRatio
//          + 0.10·liquidityRatio + 0.10·trend
//
//  Where each ratio is human-side / average-other-non-self-AI-side, normalized
//  so 1.0 = parity. Trend is the slope of the last 3 raw scores (positive = the
//  human is pulling ahead). The score is mapped to a level with hysteresis:
//
//    upgrade Normal → Hard  when score > 1.30 (and stays ≥1.20 to keep Hard)
//    downgrade Normal → Easy when score < 0.75 (and stays ≤0.85 to keep Easy)
//
//  This widens the inner band so the bot doesn't flip levels every two turns
//  on noise; only sustained advantage triggers a change.
//
//  A 4-turn warmup keeps everything at Normal until enough state has built up
//  to be meaningful (otherwise the very first eval would flip on starter cash
//  divisions).
//
//  Silent by default. Set window.__AI_ADAPTIVE_DEBUG = true to log
//  transitions to the console.
// ============================================================
function __aiNetWorth(playerIdx) {
	if (!player[playerIdx]) return 0;
	var net = player[playerIdx].money;
	for (var i = 0; i < 40; i++) {
		var sq = square[i];
		if (sq.owner !== playerIdx) continue;
		net += sq.mortgage ? Math.round(sq.price * 0.45) : sq.price;
		if (sq.house > 0) net += sq.house * (sq.houseprice || 0);
		if (sq.hotel)     net += 5 * (sq.houseprice || 0);
	}
	if (player[playerIdx].communityChestJailCard) net += 25;
	if (player[playerIdx].chanceJailCard)         net += 25;
	return net;
}

function AIAdaptive(p) {
	this.alertList = "";
	this.constructor.count++;
	p.name = __pickAIName();

	// Save name once and restore after each sub-construction (each sub-AI's
	// constructor calls __pickAIName and overwrites p.name).
	var savedName = p.name;
	this._easy   = new AIEasy(p);   p.name = savedName;
	this._normal = new AINormal(p); p.name = savedName;
	this._hard   = new AIHard(p);   p.name = savedName;
	// Only AIAdaptive.count should reflect this player.
	AIEasy.count--;
	AINormal.count--;
	AIHard.count--;

	this._level = 'normal';
	var turnCount = 0;
	var scoreHistory = []; // raw composite scores, max 4 entries
	var self = this;

	// Hysteresis thresholds: cross outer to enter the level, fall back through
	// inner to leave it. Asymmetric bands prevent ping-ponging.
	var UP_ENTER   = 1.30, UP_LEAVE   = 1.20; // Hard ↔ Normal
	var DOWN_ENTER = 0.75, DOWN_LEAVE = 0.85; // Easy ↔ Normal
	var WARMUP_TURNS = 4;
	var EVAL_EVERY   = 2;

	function active() {
		if (self._level === 'easy') return self._easy;
		if (self._level === 'hard') return self._hard;
		return self._normal;
	}

	function ratioVs(humanVal, aiVal) {
		if (aiVal <= 0 && humanVal <= 0) return 1;
		if (aiVal <= 0) return 2;            // human has it, AI doesn't → "dominating"
		return humanVal / aiVal;
	}

	function computeScore() {
		var humanNet = 0, humanMonos = 0, humanLiq = 0, humanCount = 0;
		var aiNet = 0,    aiMonos = 0,    aiLiq = 0,    aiCount = 0;
		for (var i = 1; i <= pcount; i++) {
			var pp = player[i];
			if (!pp || pp.bankrupt) continue;
			var nw  = __aiNetWorth(i);
			var mn  = __aiMonopolyCount(i);
			var lq  = __aiLiquidity(i);
			if (pp.human) { humanNet += nw; humanMonos += mn; humanLiq += lq; humanCount++; }
			else if (i !== p.index) { aiNet += nw; aiMonos += mn; aiLiq += lq; aiCount++; }
		}
		if (humanCount === 0) return null;
		var avgH_net = humanNet / humanCount;
		var avgH_mn  = humanMonos / humanCount;
		var avgH_lq  = humanLiq / humanCount;
		var avgA_net = aiCount > 0 ? aiNet / aiCount : __aiNetWorth(p.index);
		var avgA_mn  = aiCount > 0 ? aiMonos / aiCount : __aiMonopolyCount(p.index);
		var avgA_lq  = aiCount > 0 ? aiLiq / aiCount : __aiLiquidity(p.index);
		var rNet  = ratioVs(avgH_net, avgA_net);
		var rMono = ratioVs(avgH_mn + 0.5, avgA_mn + 0.5); // +0.5 smooths the 0-monopolies case
		var rLiq  = ratioVs(avgH_lq, avgA_lq);

		// Trend: slope of last (up to) 3 net-worth ratios. Captured separately
		// from current score so a slowly-rising human triggers earlier.
		scoreHistory.push(rNet);
		if (scoreHistory.length > 4) scoreHistory.shift();
		var trend = 1.0;
		if (scoreHistory.length >= 3) {
			var first = scoreHistory[0];
			var last  = scoreHistory[scoreHistory.length - 1];
			// Map slope into a ~[0.8, 1.2] multiplier.
			var slope = (last - first) / (scoreHistory.length - 1);
			trend = 1 + Math.max(-0.2, Math.min(0.2, slope * 0.8));
		}

		var composite = 0.55 * rNet + 0.25 * rMono + 0.10 * rLiq + 0.10 * trend;
		return { score: composite, rNet: rNet, rMono: rMono, rLiq: rLiq, trend: trend };
	}

	function reEvaluate() {
		var info = computeScore();
		if (!info) return;
		var s = info.score;
		var prev = self._level;
		// Hysteresis-driven transition table.
		if (prev === 'hard') {
			if (s < UP_LEAVE) self._level = (s < DOWN_ENTER ? 'easy' : 'normal');
		} else if (prev === 'easy') {
			if (s > DOWN_LEAVE) self._level = (s > UP_ENTER ? 'hard' : 'normal');
		} else {
			if      (s > UP_ENTER)   self._level = 'hard';
			else if (s < DOWN_ENTER) self._level = 'easy';
		}
		if (self._level !== prev && window.__AI_ADAPTIVE_DEBUG === true) {
			console.log('[adaptive ' + p.name + '] ' + prev + ' → ' + self._level +
				' (score=' + s.toFixed(2) +
				' net=' + info.rNet.toFixed(2) +
				' mono=' + info.rMono.toFixed(2) +
				' liq=' + info.rLiq.toFixed(2) +
				' trend=' + info.trend.toFixed(2) + ')');
		}
	}

	this.buyProperty = function (i)   { return active().buyProperty(i); };
	this.acceptTrade = function (t)   { return active().acceptTrade(t); };
	this.onLand      = function ()    { return active().onLand(); };
	this.postBail    = function ()    { return active().postBail(); };
	this.payDebt     = function ()    { return active().payDebt(); };
	this.bid         = function (i, b){ return active().bid(i, b); };

	this.beforeTurn = function () {
		turnCount++;
		// Warmup: don't even sample until the board has some state.
		if (turnCount > WARMUP_TURNS && (turnCount % EVAL_EVERY === 0)) {
			reEvaluate();
		}
		return active().beforeTurn();
	};

	// Exposed for tests / debugging.
	this._currentLevel = function () { return self._level; };
}
AIAdaptive.count = 0;


// Expose only the public constructors. Static `.count` properties live
// on each function object and remain mutable from monopoly.js.
window.AIEasy     = AIEasy;
window.AINormal   = AINormal;
window.AIHard     = AIHard;
window.AIAdaptive = AIAdaptive;
window.AITest     = AITest;

})();
