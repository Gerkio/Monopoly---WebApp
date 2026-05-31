// =====================================================================
// players.js — Sprint 5 split-out from monopoly.js.
// Player constructor, Trade struct, top-level player state vars
// (player[], pcount, turn, doublecount), Fisher-Yates shuffle.
// =====================================================================


function Player(name, color) {
	this.name = name;
	this.color = color;
	this.position = 0;
	this.money = 1500;
	this.creditor = -1;
	this.jail = false;
	this.jailroll = 0;
	this.communityChestJailCard = false;
	this.chanceJailCard = false;
	this.bidding = true;
	this.human = true;
	// this.AI = null;

	this.pay = function (amount, creditor) {
		// Validate input: must be a non-negative finite number. Garbage input
		// (NaN from a buggy AI, negative number, undefined) is silently
		// coerced to 0 rather than letting it warp the player's balance.
		amount = +amount;
		if (!isFinite(amount) || amount < 0) amount = 0;

		// House rule: Free Parking jackpot. Any payment to the bank
		// (creditor === 0) adds to the central pot, which is later
		// collected by whoever lands on Free Parking.
		if (creditor === 0 && amount > 0 &&
		    window.__HOUSE_RULES && window.__HOUSE_RULES.freeParkingJackpot) {
			window.__freeParkingPot = (window.__freeParkingPot || 0) + amount;
			if (typeof __updateFPBadge === 'function') __updateFPBadge();
		}

		if (amount <= this.money) {
			this.money -= amount;
			updateMoney();
			return true;
		} else {
			this.money -= amount;
			this.creditor = creditor;
			updateMoney();
			return false;
		}
	};
}

// paramaters:
// initiator: object Player
// recipient: object Player
// money: integer, positive for offered, negative for requested
// property: array of integers, length: 40
// communityChestJailCard: integer, 1 means offered, -1 means requested, 0 means neither
// chanceJailCard: integer, 1 means offered, -1 means requested, 0 means neither
function Trade(initiator, recipient, money, property, communityChestJailCard, chanceJailCard) {
	// For each property and get out of jail free cards, 1 means offered, -1 means requested, 0 means neither.

	this.getInitiator = function() {
		return initiator;
	};

	this.getRecipient = function() {
		return recipient;
	};

	this.getProperty = function(index) {
		return property[index];
	};

	this.getMoney = function() {
		return money;
	};

	this.getCommunityChestJailCard = function() {
		return communityChestJailCard;
	};

	this.getChanceJailCard = function() {
		return chanceJailCard;
	};
}

var player = [];
var pcount;
var turn = 0, doublecount = 0;

// Fisher-Yates shuffle. In-place, uniformly distributed. Used for the
// Chance/CC decks — the previous sort-with-Math.random comparator was
// non-transitive and produced biased orderings (notably the first/last
// cards were drawn out of proportion).
function __shuffle(arr) {
	for (var i = arr.length - 1; i > 0; i--) {
		var j = Math.floor(Math.random() * (i + 1));
		var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
	}
	return arr;
}
