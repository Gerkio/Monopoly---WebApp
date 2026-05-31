// ============================================================
//  ai-worker.js — heavy compute offloaded to a Web Worker
//
//  Sprint 7.1: AIAdaptive's reEvaluate() iterates all players and
//  all 40 squares to compute netWorth / monopolyCount / liquidity
//  ratios. On low-end mobile that can chew ~200ms of main-thread
//  time per AI turn. Moving the math here keeps the UI thread free.
//
//  Protocol (postMessage)
//  ----------------------
//  Inbound:
//    {
//      id: number,          // correlation id (sender chooses)
//      type: "evaluate",
//      level: "adaptive",   // only level supported in v1
//      action: "beforeTurn",
//      state: {
//        turn: number,
//        pcount: number,
//        ownIdx: number,    // the adaptive AI's player index
//        players: [
//          { idx, money, bankrupt, human,
//            communityChestJailCard, chanceJailCard, jail, position }
//        ],
//        squares: [
//          { owner, mortgage, house, hotel, price, groupNumber,
//            color, name, houseprice, baserent,
//            rent1, rent2, rent3, rent4, rent5 }
//        ],
//        history: number[]  // previous rNet samples (for trend)
//      }
//    }
//
//  Outbound:
//    {
//      id: number,
//      type: "evaluate:result",
//      level: "easy" | "normal" | "hard",
//      score: number,
//      rNet: number, rMono: number, rLiq: number, trend: number,
//      history: number[]    // updated history (sender stores back)
//    }
//
//  No DOM access; pure compute. ES6+ is fine in worker context.
// ============================================================

"use strict";

// ------------------------------------------------------------
// Shared strategic data — mirror of ai.js helpers, stateless.
// ------------------------------------------------------------

const GROUP_VALUE = {
	1: 7,   // railroads
	2: 4,   // utilities
	3: 4,   // brown
	4: 5,   // light blue
	5: 6,   // pink
	6: 9,   // orange
	7: 8,   // red
	8: 8,   // yellow
	9: 7,   // green
	10: 7   // blue
};

function groupSize(g) {
	if (g === 1) return 4;
	if (g === 2 || g === 3 || g === 10) return 2;
	return 3;
}

function ownedInGroup(squares, playerIdx, g) {
	let n = 0;
	for (let i = 0; i < squares.length; i++) {
		const s = squares[i];
		if (s && s.groupNumber === g && s.owner === playerIdx) n++;
	}
	return n;
}

function ownsGroup(squares, playerIdx, g) {
	return !!g && ownedInGroup(squares, playerIdx, g) === groupSize(g);
}

function monopolyCount(squares, playerIdx) {
	let n = 0;
	for (let g = 1; g <= 10; g++) {
		if (ownsGroup(squares, playerIdx, g)) n++;
	}
	return n;
}

// Net worth = cash + property book value + house/hotel resale + jail cards.
// Mirrors __aiNetWorth in ai.js.
function netWorth(state, playerIdx) {
	const p = state.players.find((pp) => pp && pp.idx === playerIdx);
	if (!p) return 0;
	let net = p.money || 0;
	const squares = state.squares;
	for (let i = 0; i < squares.length; i++) {
		const sq = squares[i];
		if (!sq || sq.owner !== playerIdx) continue;
		net += sq.mortgage ? Math.round((sq.price || 0) * 0.45) : (sq.price || 0);
		if (sq.house > 0) net += sq.house * (sq.houseprice || 0);
		if (sq.hotel)     net += 5 * (sq.houseprice || 0);
	}
	if (p.communityChestJailCard) net += 25;
	if (p.chanceJailCard)         net += 25;
	return net;
}

// Liquid value player could raise NOW. Mirrors __aiLiquidity in ai.js.
function liquidity(state, playerIdx) {
	const p = state.players.find((pp) => pp && pp.idx === playerIdx);
	if (!p) return 0;
	let liq = p.money || 0;
	const squares = state.squares;
	for (let i = 0; i < squares.length; i++) {
		const sq = squares[i];
		if (!sq || sq.owner !== playerIdx) continue;
		if (!sq.mortgage && sq.house === 0 && !sq.hotel) {
			liq += Math.round((sq.price || 0) * 0.5);
		}
		if (sq.house > 0) liq += sq.house * Math.round((sq.houseprice || 0) * 0.5);
		if (sq.hotel)     liq += 5 * Math.round((sq.houseprice || 0) * 0.5);
	}
	return liq;
}

function ratioVs(humanVal, aiVal) {
	if (aiVal <= 0 && humanVal <= 0) return 1;
	if (aiVal <= 0) return 2;
	return humanVal / aiVal;
}

// ------------------------------------------------------------
// Main eval — returns a recommended level for AIAdaptive.
// Hysteresis is NOT applied here; the caller in ai.js layers it
// on top of the raw score so the worker stays purely stateless.
// ------------------------------------------------------------
const UP_ENTER   = 1.30;
const DOWN_ENTER = 0.75;

function evaluateAdaptive(state) {
	const players = state.players || [];
	const pcount  = state.pcount || 0;
	const ownIdx  = state.ownIdx;

	let humanNet = 0, humanMonos = 0, humanLiq = 0, humanCount = 0;
	let aiNet = 0,    aiMonos = 0,    aiLiq = 0,    aiCount = 0;

	for (let i = 1; i <= pcount; i++) {
		const pp = players.find((p) => p && p.idx === i);
		if (!pp || pp.bankrupt) continue;
		const nw = netWorth(state, i);
		const mn = monopolyCount(state.squares, i);
		const lq = liquidity(state, i);
		if (pp.human) {
			humanNet += nw; humanMonos += mn; humanLiq += lq; humanCount++;
		} else if (i !== ownIdx) {
			aiNet += nw; aiMonos += mn; aiLiq += lq; aiCount++;
		}
	}
	if (humanCount === 0) return null;

	const avgH_net = humanNet / humanCount;
	const avgH_mn  = humanMonos / humanCount;
	const avgH_lq  = humanLiq / humanCount;
	const avgA_net = aiCount > 0 ? aiNet / aiCount : netWorth(state, ownIdx);
	const avgA_mn  = aiCount > 0 ? aiMonos / aiCount : monopolyCount(state.squares, ownIdx);
	const avgA_lq  = aiCount > 0 ? aiLiq / aiCount : liquidity(state, ownIdx);

	const rNet  = ratioVs(avgH_net, avgA_net);
	const rMono = ratioVs(avgH_mn + 0.5, avgA_mn + 0.5);
	const rLiq  = ratioVs(avgH_lq, avgA_lq);

	// Trend: slope of last (up to 3) rNet samples, mapped to ~[0.8, 1.2].
	const history = Array.isArray(state.history) ? state.history.slice() : [];
	history.push(rNet);
	while (history.length > 4) history.shift();
	let trend = 1.0;
	if (history.length >= 3) {
		const first = history[0];
		const last  = history[history.length - 1];
		const slope = (last - first) / (history.length - 1);
		trend = 1 + Math.max(-0.2, Math.min(0.2, slope * 0.8));
	}

	const score = 0.55 * rNet + 0.25 * rMono + 0.10 * rLiq + 0.10 * trend;

	// Raw level recommendation (the caller applies hysteresis).
	let level = "normal";
	if      (score > UP_ENTER)   level = "hard";
	else if (score < DOWN_ENTER) level = "easy";

	return {
		level: level,
		score: score,
		rNet: rNet,
		rMono: rMono,
		rLiq: rLiq,
		trend: trend,
		history: history
	};
}

// ------------------------------------------------------------
// Worker entry point.
// ------------------------------------------------------------
self.onmessage = function (e) {
	const msg = e && e.data;
	if (!msg || msg.type !== "evaluate") return;
	let result = null;
	try {
		if (msg.level === "adaptive") {
			result = evaluateAdaptive(msg.state || {});
		}
	} catch (err) {
		// Swallow — caller will fall back to the sync path on a null result.
		result = null;
	}
	self.postMessage({
		id: msg.id,
		type: "evaluate:result",
		level:   result ? result.level   : null,
		score:   result ? result.score   : null,
		rNet:    result ? result.rNet    : null,
		rMono:   result ? result.rMono   : null,
		rLiq:    result ? result.rLiq    : null,
		trend:   result ? result.trend   : null,
		history: result ? result.history : null
	});
};
