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

	var resetTrade = function(initiator, recipient, allowRecipientToBeChanged) {
		var currentSquare;
		var currentTableRow;
		var currentTableCell;
		var currentTableCellCheckbox;
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

			// Offered properties.
			if (currentSquare.owner === initiator.index) {
				currentTableRow = initiatorSideTable.appendChild(document.createElement("tr"));
				currentTableRow.onclick = tableRowOnClick;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcheckbox";
				currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
				currentTableCellCheckbox.type = "checkbox";
				currentTableCellCheckbox.id = "tradeleftcheckbox" + i;
				currentTableCellCheckbox.title = t('trade.includePropertyTitle', { place: currentSquare.name });

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcolor";
				currentTableCell.style.backgroundColor = currentSquare.color;

				if (currentSquare.groupNumber == 1 || currentSquare.groupNumber == 2) {
					currentTableCell.style.borderColor = "grey";
				} else {
					currentTableCell.style.borderColor = currentSquare.color;
				}

				currentTableCell.propertyIndex = i;
				currentTableCell.onmouseover = function() {showdeed(this.propertyIndex);};
				currentTableCell.onmouseout = hidedeed;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellname";
				if (currentSquare.mortgage) {
					currentTableCell.title = t('stats.mortgagedTooltip');
					currentTableCell.style.color = "grey";
				}
				currentTableCell.textContent = currentSquare.name;

			// Requested properties.
			} else if (currentSquare.owner === recipient.index) {
				currentTableRow = recipientSideTable.appendChild(document.createElement("tr"));
				currentTableRow.onclick = tableRowOnClick;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcheckbox";
				currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
				currentTableCellCheckbox.type = "checkbox";
				currentTableCellCheckbox.id = "traderightcheckbox" + i;
				currentTableCellCheckbox.title = t('trade.includePropertyTitle', { place: currentSquare.name });

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcolor";
				currentTableCell.style.backgroundColor = currentSquare.color;

				if (currentSquare.groupNumber == 1 || currentSquare.groupNumber == 2) {
					currentTableCell.style.borderColor = "grey";
				} else {
					currentTableCell.style.borderColor = currentSquare.color;
				}

				currentTableCell.propertyIndex = i;
				currentTableCell.onmouseover = function() {showdeed(this.propertyIndex);};
				currentTableCell.onmouseout = hidedeed;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellname";
				if (currentSquare.mortgage) {
					currentTableCell.title = t('stats.mortgagedTooltip');
					currentTableCell.style.color = "grey";
				}
				currentTableCell.textContent = currentSquare.name;
			}
		}

		if (initiator.communityChestJailCard) {
			currentTableRow = initiatorSideTable.appendChild(document.createElement("tr"));
			currentTableRow.onclick = tableRowOnClick;

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcheckbox";
			currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
			currentTableCellCheckbox.type = "checkbox";
			currentTableCellCheckbox.id = "tradeleftcheckbox40";
			currentTableCellCheckbox.title = t('trade.includeCardTitle');

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcolor";
			currentTableCell.style.backgroundColor = "white";
			currentTableCell.style.borderColor = "grey";

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellname";

			currentTableCell.textContent = t('stats.gojfCard');
		} else if (recipient.communityChestJailCard) {
			currentTableRow = recipientSideTable.appendChild(document.createElement("tr"));
			currentTableRow.onclick = tableRowOnClick;

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcheckbox";
			currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
			currentTableCellCheckbox.type = "checkbox";
			currentTableCellCheckbox.id = "traderightcheckbox40";
			currentTableCellCheckbox.title = t('trade.includeCardTitle');

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcolor";
			currentTableCell.style.backgroundColor = "white";
			currentTableCell.style.borderColor = "grey";

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellname";

			currentTableCell.textContent = t('stats.gojfCard');
		}

		if (initiator.chanceJailCard) {
			currentTableRow = initiatorSideTable.appendChild(document.createElement("tr"));
			currentTableRow.onclick = tableRowOnClick;

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcheckbox";
			currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
			currentTableCellCheckbox.type = "checkbox";
			currentTableCellCheckbox.id = "tradeleftcheckbox41";
			currentTableCellCheckbox.title = t('trade.includeCardTitle');

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcolor";
			currentTableCell.style.backgroundColor = "white";
			currentTableCell.style.borderColor = "grey";

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellname";

			currentTableCell.textContent = t('stats.gojfCard');
		} else if (recipient.chanceJailCard) {
			currentTableRow = recipientSideTable.appendChild(document.createElement("tr"));
			currentTableRow.onclick = tableRowOnClick;

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcheckbox";
			currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
			currentTableCellCheckbox.type = "checkbox";
			currentTableCellCheckbox.id = "traderightcheckbox41";
			currentTableCellCheckbox.title = t('trade.includeCardTitle');

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellcolor";
			currentTableCell.style.backgroundColor = "white";
			currentTableCell.style.borderColor = "grey";

			currentTableCell = currentTableRow.appendChild(document.createElement("td"));
			currentTableCell.className = "propertycellname";

			currentTableCell.textContent = t('stats.gojfCard');
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
		var HTML = "<p>" + t('popup.bankruptcyUnmortgageNote', { recipient: player[creditor].name }) + "</p><table>";
		var price;
		var sq;
		var rowIds = [];

		for (var i = 0; i < 40; i++) {
			sq = square[i];
			if (sq.owner == p.index && sq.mortgage) {
				price = Math.round(sq.price * 0.5);
				var rowId = 'bunmrow-' + i;
				rowIds.push({ rowId: rowId, idx: i, price: price });

				HTML += "<tr id='" + rowId + "'><td class='propertycellcolor' style='background: " + sq.color + ";";
				HTML += (sq.groupNumber == 1 || sq.groupNumber == 2)
					? " border: 1px solid grey;"
					: " border: 1px solid " + sq.color + ";";

				HTML += "' onmouseover='showdeed(" + i + ");' onmouseout='hidedeed();'></td>";
				HTML += "<td class='propertycellname'><a href='javascript:void(0);' "
					+ "id='" + rowId + "-link' "
					+ "data-prop-index='" + i + "' data-prop-price='" + price + "'>"
					+ t('popup.unmortgageProp', { place: sq.name, amount: price }) + "</a></td></tr>";

				sq.owner = creditor;
			}
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

		if (p.creditor !== 0) {
			pcredit.money += p.money;
		}

		for (var i = 0; i < 40; i++) {
			sq = square[i];
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
		if (p.avatar && window.__AVATAR_OPTIONS) {
			for (var i = 0; i < window.__AVATAR_OPTIONS.length; i++) {
				if (window.__AVATAR_OPTIONS[i].id === p.avatar) {
					file = window.__AVATAR_OPTIONS[i].file;
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
	$alert = $("#alert");

	// Insert a thin "Turn X — Name" divider whenever the active player changes.
	if (turn !== __alertLastTurn && player[turn]) {
		__alertLastTurn = turn;
		var sep = document.createElement('div');
		sep.className = 'alert-turn-sep';
		var dot = document.createElement('span');
		dot.className = 'alert-turn-dot';
		dot.style.background = player[turn].color;
		sep.appendChild(dot);
		sep.appendChild(document.createTextNode(player[turn].name));
		$alert[0].appendChild(sep);
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
	$alert[0].appendChild(row);

	// Bound DOM growth on long games; oldest entries are scrolled out anyway.
	var maxEntries = 200;
	var children = $alert.children();
	if (children.length > maxEntries) {
		children.slice(0, children.length - maxEntries).remove();
	}

	// Animate scrolling down alert element.
	$alert.stop().animate({"scrollTop": $alert.prop("scrollHeight")}, 1000);

	if (!player[turn].human) {
		// alertList is later injected via innerHTML by popup(); escape the text.
		player[turn].AI.alertList += "<div>" + I18N.escape(alertText) + "</div>";
		// Bound AI alertList growth to avoid unbounded memory usage
		// during very long automated games. Keep the tail end.
		try {
			var maxChars = 8192;
			if (player[turn].AI.alertList.length > maxChars) {
				player[turn].AI.alertList = player[turn].AI.alertList.slice(-maxChars);
			}
		} catch (e) {}
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
			$('#popupbackground').fadeIn(200);
			$('#popupwrap').show();
			__renderAuctionBidders();
		});
	}
}

// Wrap an AI player's per-turn recap (the accumulated alertList) in a
// rich header so the popup is visually consistent with the rest of the
// game and easy to scan from across a tabletop. The alertList itself is
// pre-built HTML built up by addAlert(); we just prepend a header card
// with the player's color, name, and a short "turn recap" label.
function __formatAIRecap(p) {
	var color = p && p.color ? p.color : 'var(--ink-muted)';
	var name = p && p.name ? I18N.escape(p.name) : '';
	var labelTurn = t('panel.aiRecapTitle') || 'Turn recap';
	return (
		'<div class="ai-recap">' +
			'<div class="ai-recap-head">' +
				'<span class="ai-recap-dot" style="background:' + color + '"></span>' +
				'<div class="ai-recap-headtext">' +
					'<div class="ai-recap-name" style="color:' + color + '">' + name + '</div>' +
					'<div class="ai-recap-label">🤖 ' + I18N.escape(labelTurn) + '</div>' +
				'</div>' +
			'</div>' +
			'<div class="ai-recap-body">' + (p && p.AI && p.AI.alertList || '') + '</div>' +
		'</div>'
	);
}

// =====================================================================
// Auto-roll countdown — keeps the game flowing when a player wanders off
// or forgets it's their turn. Arms when play() detects a human's roll
// phase; visible badge counts down once per second on the "Tirar dados"
// button; ANY interaction with the dice / button / movement input cancels
// the timer. When it hits zero, the same code path the human would
// trigger fires (game.next() → roll()).
// Configurable via window.__AUTO_ROLL_MS (default 20s). Set <= 0 to
// disable (e.g. for a relaxed local game).
// =====================================================================
var __autoRollInterval = null;
var __autoRollListenersBound = false;
var __AUTO_ROLL_MS_DEFAULT = 20000;

function __getAutoRollMs() {
	var v = (typeof window !== 'undefined') ? window.__AUTO_ROLL_MS : undefined;
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
	if (window.__popupAutoTimer) {
		clearInterval(window.__popupAutoTimer);
		window.__popupAutoTimer = null;
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

		$("#popupyes, #popupno").on("click", function() {
			__popupCancelAuto();
			$("#popupwrap").hide();
			$("#popupbackground").fadeOut(400, restoreFocus);
		});

		$("#popupyes").on("click", action);

	// Ok
	} else if (option !== "blank") {
		$("#popuptext").append("<div><input type='button' value='" + I18N.escape(t('ui.ok')) + "' id='popupclose' /></div>");
		$("#popupclose").focus();

		$("#popupclose").on("click", function() {
			__popupCancelAuto();
			$("#popupwrap").hide();
			$("#popupbackground").fadeOut(400, restoreFocus);
		}).on("click", action);

	}

	// Show using animation.
	$("#popupbackground").fadeIn(400, function() {
		$("#popupwrap").show();
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

	window.__popupAutoTimer = setInterval(function () {
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
	if (window.__popupAutoTimer) {
		clearInterval(window.__popupAutoTimer);
		window.__popupAutoTimer = null;
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

var __tokens = {};           // playerIndex -> { el: <div> }
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
	var scale = (window.__STAGE_TX && window.__STAGE_TX.scale) || 1;
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
	var rule = window.__HOUSE_RULES && window.__HOUSE_RULES.freeParkingJackpot;
	var pot = window.__freeParkingPot || 0;
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
	if (!window.__HOUSE_RULES || !window.__HOUSE_RULES.freeParkingJackpot) return;
	var pot = window.__freeParkingPot || 0;
	if (pot <= 0) return;
	p.money += pot;
	window.__freeParkingPot = 0;
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
// on window.__startingCash; setup() reads from there when instantiating players.
window.__applyPreset = function (kind) {
	var amount = 1500;
	if (kind === 'quick') amount = 1000;
	else if (kind === 'long') amount = 2500;
	window.__startingCash = amount;
	// Visual feedback: highlight the chosen preset button.
	var btns = document.querySelectorAll('.setup-preset');
	for (var i = 0; i < btns.length; i++) btns[i].classList.remove('setup-preset-active');
	var match = document.querySelector('.setup-preset[onclick*="' + kind + '"]');
	if (match) match.classList.add('setup-preset-active');
};

// Triggered by the "Auction now" button on the landed-on-unowned-property UI.
// Effectively: skip buying and immediately start the auction for this tile.
// The tile is already queued via game.addPropertyToAuctionQueue() in land().
window.__startAuctionFromLanded = function () {
	// Hide the buy/auction prompts and kick off the auction.
	$('#landed').hide();
	$('#buy').hide();
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
	} catch (e) {}

	// Hide the live gameplay UI behind the overlay so the only clickable
	// elements are the overlay's own CTAs.
	$("#moneybar").hide();

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
	} catch (e) {}

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
	window.__victoryOverlay = overlay;

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
	var scale = (window.__STAGE_TX && window.__STAGE_TX.scale) || 1;
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
//   2. `window.__walking` is the single source of truth used by `game.next()`
//      to refuse re-entry. We set it true synchronously here and only release
//      it when this walk's final done() fires — including in all early-exit
//      branches.
//   3. The final destination cell is `(startPos + steps) % 40`. The caller is
//      responsible for setting `p.position` to the SAME value before calling.
//      If they differ, we'd see "the token moved fewer/more steps than the
//      dice"; the guards below make sure no second walk can overwrite this.
function __walkPlayerSteps(playerSlot, startPos, steps, done) {
	var tok = __tokens && __tokens[playerSlot];
	function safeDone() { window.__walking = false; if (done) { var d = done; done = null; d(); } }
	if (!tok || !steps || steps <= 0) { window.__walking = false; if (done) done(); return; }
	if (!tok.el.parentNode) { window.__walking = false; if (done) done(); return; }

	// Cancel any prior walk on this token. Both the timer and the run-id
	// guard together stop the previous chain from firing further steps.
	if (tok.__walkTimer) { clearTimeout(tok.__walkTimer); tok.__walkTimer = null; }
	tok.__walkRunId = (tok.__walkRunId || 0) + 1;
	var myRunId = tok.__walkRunId;

	window.__walking = true;

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
			else safeDone();
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
	if (window.__lastHighlightedCellId) {
		var prevEl = document.getElementById(window.__lastHighlightedCellId);
		if (prevEl) prevEl.style.border = '';
	}
	window.__lastHighlightedCellId = null;

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
		if (p.avatar && window.__AVATAR_OPTIONS) {
			for (var ax = 0; ax < window.__AVATAR_OPTIONS.length; ax++) {
				if (window.__AVATAR_OPTIONS[ax].id === p.avatar) {
					avFile = window.__AVATAR_OPTIONS[ax].file;
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
		window.__lastHighlightedCellId = highlightId;
	}
}

// Previous-frame snapshot of each player's money so updateMoney() can detect
// deltas and pulse the affected cell. Initialized empty; first call seeds it
// without animating (avoids a spurious pulse at game start).
var __prevMoney = {};

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

	pmoneyEl.innerHTML = "$" + p.money;
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
		$("#landed").hide();
	}

	document.getElementById("quickstats").style.borderColor = p.color;
	// Enriched quickstats: avatar + name + cash + current cell + turn-order
	// preview. Builds DOM only once and keeps the original #pname / #pmoney
	// spans (other code mutates them).
	__renderQuickStats(p);

	if (p.money < 0) {
		// document.getElementById("nextbutton").disabled = true;
		$("#resignbutton").show();
		$("#nextbutton").hide();
	} else {
		// document.getElementById("nextbutton").disabled = false;
		$("#resignbutton").hide();
		$("#nextbutton").show();
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
		if (window.__walking) return;
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
		if (window.__walking) { return; }
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
			} catch (e) {}
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
		window.__skipNextUpdateDice = true;
		try {
			var btn = document.getElementById('nextbutton');
			if (btn && document.getElementById('control').style.display !== 'none') {
				btn.click();
			}
		} finally {
			window.__skipNextUpdateDice = false;
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

	$("#die0").show();
	$("#die1").show();

	// If the throw handler already landed the cubes on the rolled faces,
	// skip the tumble AND the dice-tick sound — flingPair() already played
	// Sound.dice() at throw-start and Sound.diceLand() at touchdown, so
	// another tick here would be a third audible event.
	// Flag is NOT cleared here because roll() can call updateDice twice
	// in the doubles path. continueGameRoll clears it after btn.click()
	// returns (i.e. after the entire synchronous roll completes).
	if (window.__skipNextUpdateDice) {
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
	$("#option").show();
	$("#owned").show();

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
		$("#option").hide();
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
	$(".property-cell-row").click(function() {
		var row = this;

		// Toggle check the current checkbox.
		$(this).find(".propertycellcheckbox > input").prop("checked", function(index, val) {
			return !val;
		});

		// Set all other checkboxes to false.
		$(".propertycellcheckbox > input").prop("checked", function(index, val) {
			if (!$.contains(row, this)) {
				return false;
			}
		});

		updateOption();
	});
	updateOption();
}

// "Nothing selected" view: show bank's remaining building inventory.
// Renders the global pool counters (32 houses / 12 hotels total).
function _renderBuildingsSummary() {
	$("#buyhousebutton").hide();
	$("#sellhousebutton").hide();
	$("#mortgagebutton").hide();

	var housesum = 32, hotelsum = 12;
	for (var i = 0; i < 40; i++) {
		var s = square[i];
		if (s.hotel == 1) hotelsum--;
		else housesum -= s.house;
	}
	$("#buildings").show();
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
	$("#buyhousebutton").hide();
	$("#sellhousebutton").hide();
}

// Render the manage panel for an owned, non-mortgaged property in a buildable
// group (street). Handles the even-build rule, mortgage availability, and the
// hotel-replaces-houses display tweak.
function _renderBuildingOptions(sq) {
	var buyhousebutton = document.getElementById("buyhousebutton");
	var sellhousebutton = document.getElementById("sellhousebutton");

	$("#buyhousebutton").show();
	$("#sellhousebutton").show();
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
		$("#buyhousebutton").hide();
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
		$("#sellhousebutton").hide();
	} else {
		$("#mortgagebutton").hide();
	}

	// Mortgage requires unimproved across the whole color group.
	if (!allGroupUninproved) {
		document.getElementById("mortgagebutton").title = t('manage.mortgageNeedUnimproved');
		document.getElementById("mortgagebutton").disabled = true;
	}
}

function updateOption() {
	$("#option").show();
	var checkedproperty = getCheckedProperty();

	if (checkedproperty < 0 || checkedproperty >= 40) {
		_renderBuildingsSummary();
		return;
	}

	$("#buildings").hide();
	var sq = square[checkedproperty];

	$("#mortgagebutton").show();
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
			$("#buyhousebutton").hide();
			$("#sellhousebutton").hide();
		}
	}

	// Re-sync color-group ownership halos on every owned-state change.
	if (typeof __refreshGroupVisuals === 'function') __refreshGroupVisuals();
}

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
		popup(__formatAIRecap(p), game.next, undefined, { autoMs: 8000 });
		p.AI.alertList = "";
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

	updatePosition();

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

	$("#landed").hide();
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

	$("#landed").hide();
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
		if (p.avatar && window.__AVATAR_OPTIONS) {
			for (var aix = 0; aix < window.__AVATAR_OPTIONS.length; aix++) {
				if (window.__AVATAR_OPTIONS[aix].id === p.avatar) { avFileStats = window.__AVATAR_OPTIONS[aix].file; break; }
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
	$("#statsbackground").fadeIn(400, function() {
		$("#statswrap").show();
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
	$("#deed").show();

	$("#deed-normal").hide();
	$("#deed-mortgaged").hide();
	$("#deed-special").hide();

	if (sq.mortgage) {
		$("#deed-mortgaged").show();
		document.getElementById("deed-mortgaged-name").textContent = sq.name;
		document.getElementById("deed-mortgaged-mortgage").textContent = (sq.price / 2);

	} else {

		if (sq.groupNumber >= 3) {
			$("#deed-normal").show();
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
			$("#deed-special").show();
			document.getElementById("deed-special-name").textContent = sq.name;
			document.getElementById("deed-special-price-amount").textContent = sq.price;
			document.getElementById("deed-special-text").innerHTML = utiltext();
			document.getElementById("deed-special-mortgage").textContent = (sq.price / 2);
			__deedDecorateSpecial(sq);

		} else if (sq.groupNumber == 1) {
			$("#deed-special").show();
			document.getElementById("deed-special-name").textContent = sq.name;
			document.getElementById("deed-special-price-amount").textContent = sq.price;
			document.getElementById("deed-special-text").innerHTML = transtext();
			document.getElementById("deed-special-mortgage").textContent = (sq.price / 2);
			__deedDecorateSpecial(sq);
		}
	}
}

function hidedeed() {
	$("#deed").hide();
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

		// Visual celebration: cell pulses in the new owner's color so it's
		// immediately obvious which property changed hands.
		__pulsePurchasedCell(p.position, p.color);

		updateOwned();

		$("#landed").hide();

	} else {
		popup("<p>" + t('popup.needForHouse', { amount: (property.price - p.money), place: property.name }) + "</p>");
	}
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

	$("#landed").show();
	document.getElementById("landed").innerHTML = t('landed.youLandedOn', { place: s.name });
	s.landcount++;
	addAlert(t('alert.landedOn', { player: p.name, place: s.name }));

	// Allow player to buy the property on which he landed.
	if (s.price !== 0 && s.owner === 0) {

		if (!p.human) {

			if (p.AI.buyProperty(p.position)) {
				buy();
			}
		} else {
			var noAuc = !!(window.__HOUSE_RULES && window.__HOUSE_RULES.noAuctions);
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
		if (!(window.__HOUSE_RULES && window.__HOUSE_RULES.noAuctions)) {
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
		popup(__formatAIRecap(p), chanceCommunityChest, undefined, { autoMs: 8000 });
		p.AI.alertList = "";
	} else {
		chanceCommunityChest();
	}
}

// House rule: $500 bonus for snake-eyes (double 1s). No-op unless the rule
// is toggled in setup. Kept separate so the main roll flow stays readable.
function _applySnakeEyesBonus(p) {
	if (!(window.__HOUSE_RULES && window.__HOUSE_RULES.snakeEyesBonus)) return;
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
	updateDice(die1, die2);

	if (die1 == die2) {
		document.getElementById("jail").style.border = "1px solid black";
		document.getElementById("cell11").style.border = "2px solid " + p.color;
		$("#landed").hide();

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

	$("#landed").show();
	document.getElementById("landed").innerHTML = t('landed.inJail');
	if (!p.human) {
		popup(__formatAIRecap(p), game.next, undefined, { autoMs: 8000 });
		p.AI.alertList = "";
	}
}

// Normal non-jail movement: advance, pay GO salary if wrapped, walk.
function _handleNormalMove(p, die1, die2) {
	updateDice(die1, die2);

	var startPos = p.position;
	var moveAmount = die1 + die2;
	p.position += moveAmount;

	// House rule: Double GO pays $400 if you LAND EXACTLY on GO (p.position === 40).
	if (p.position >= 40) {
		var landedExactlyOnGo = (p.position === 40);
		p.position -= 40;
		var salary = (landedExactlyOnGo && window.__HOUSE_RULES && window.__HOUSE_RULES.doubleGo) ? 400 : 200;
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
	if (window.__walking) return;
	var p = player[turn];

	$("#option").hide();
	$("#buy").show();
	$("#manage").hide();

	if (p.human) document.getElementById("nextbutton").focus();
	document.getElementById("nextbutton").value = t('ui.endTurn');
	document.getElementById("nextbutton").title = t('ui.endTurnTitle');

	// Skip the actual rollDice call if the dice were just thrown by the
	// user — the throw handler (flingPair) already called rollDice and
	// the cubes are already showing the rolled faces.
	if (!window.__skipNextUpdateDice) game.rollDice();
	if (typeof __setRollPulse === 'function') __setRollPulse(false);

	var die1 = game.getDie(1);
	var die2 = game.getDie(2);
	doublecount++;

	if (die1 == die2) {
		addAlert(t('alert.rolledDoubles', { player: p.name, n: die1 + die2 }));
		if (die1 === 1) _applySnakeEyesBonus(p);
	} else {
		addAlert(t('alert.rolled', { player: p.name, n: die1 + die2 }));
	}

	if (die1 == die2 && !p.jail) {
		updateDice(die1, die2);
		if (doublecount < 3) {
			document.getElementById("nextbutton").value = t('ui.rollAgain');
			document.getElementById("nextbutton").title = t('ui.rollAgainTitle');
		} else {
			// Three doubles in a row → off to jail.
			p.jail = true;
			doublecount = 0;
			addAlert(t('alert.tripleDoubles', { player: p.name }));
			updateMoney();
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

	document.getElementById("pname").textContent = p.name;

	addAlert(t('alert.isYourTurn', { player: p.name }));
	// Slide-in banner so the active player is immediately obvious.
	if (typeof __showTurnBanner === 'function') __showTurnBanner(p);
	// Brief board-border flash in the new player's color.
	if (typeof __flashBoardTurn === 'function') __flashBoardTurn(p.color);
	// Pulse Roll Dice while we're waiting on a human to roll; turn it off
	// for AI turns (the AI rolls automatically, no need to draw attention).
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

	$("#landed, #option, #manage").hide();
	$("#board, #control, #moneybar, #viewstats, #buy").show();

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
	$("#die0").show();
	$("#die1").show();

	// Arm the auto-roll timer for HUMAN turns. AI flows trigger their own
	// rolls, so we skip them. Any prior timer is wiped first (paranoid: a
	// stale timer from a previous turn would fire on the wrong player).
	if (p.human && typeof __armAutoRoll === 'function') __armAutoRoll();
	else if (typeof __cancelAutoRoll === 'function') __cancelAutoRoll();

	if (p.jail) {
		$("#landed").show();
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

	$(".money-bar-arrow").hide();
	$("#p" + turn + "arrow").show();

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

	// Start background music matching the chosen edition. setup() runs from
	// a user click so the AudioContext is already unlocked; the play()
	// promise is wrapped in catch() inside Sound, so a denied autoplay
	// won't throw.
	if (typeof Sound !== 'undefined' && Sound.playMusicForEdition) {
		Sound.playMusicForEdition(window.__EDITION);
	}

	// ----- House rules: read toggles, expose globally for game logic -----
	function __readHouseRule(id) {
		var el = document.getElementById(id);
		return !!(el && el.checked);
	}
	window.__HOUSE_RULES = {
		freeParkingJackpot: __readHouseRule('rule-free-parking-jackpot'),
		snakeEyesBonus:     __readHouseRule('rule-snake-eyes-bonus'),
		doubleGo:           __readHouseRule('rule-double-go'),
		noAuctions:         __readHouseRule('rule-no-auctions'),
		speedMode:          __readHouseRule('rule-speed-mode')
	};
	window.__freeParkingPot = 0;
	// Apply speed-mode class to body so CSS animations + transitions scale.
	if (window.__HOUSE_RULES.speedMode) document.body.classList.add('speed-mode');
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
	if (typeof AIEasy   !== 'undefined') AIEasy.count   = 0;
	if (typeof AINormal !== 'undefined') AINormal.count = 0;
	if (typeof AIHard   !== 'undefined') AIHard.count   = 0;

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
			else                      p.AI = new AINormal(p);   // default for "2" and legacy
		}
		// Initialize player state
		p.position = 0;
		p.money = (typeof window.__startingCash === 'number') ? window.__startingCash : 1500;
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
		var snapshot = { pcount: pcount, players: {}, cash: window.__startingCash || 1500 };
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
		snapshot.rules = window.__HOUSE_RULES || {};
		window.localStorage.setItem('monopoly:setup', JSON.stringify(snapshot));
	} catch (e) { /* storage unavailable — non-fatal */ }

	$("#board, #moneybar").show();
	$("#setup").hide();
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

	$(".player-input").hide();

	for (var i = 1; i <= pcount; i++) {
		$("#player" + i + "input").show();
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
	// Aspect 1.63:1 — closer to landscape laptops/monitors than the old
	// 1.38:1, so the scale picks the height-bound dimension less often
	// and the stage actually fills the screen sideways.
	var sw = 1600, sh = 980;
	// Tiny margin between the stage and the viewport edge — keeps the
	// scaled stage from kissing the bezel. 1.5 % of the smaller dimension
	// = ~16 px on a 1080p display, scales gracefully on 4K / mobile.
	var marginPx = Math.max(12, Math.round(Math.min(vw, vh) * 0.015));
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
	// translate(-50%,-50%) keeps the stage centered before scale/rotate.
	stage.style.transform = 'translate(-50%, -50%) rotate(' + rotateDeg + 'deg) scale(' + scale + ')';
	window.__STAGE_TX = { scale: scale, rotation: rotateDeg, cos: cos, sin: sin };
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
	// Highlight active language button.
	I18N.set(I18N.get());
}

function _injectAvatarPickers() {
	var AVATAR_OPTIONS = [
		{ id: 'sombrero',  label: '🎩 Sombrero',  file: 'images/sombrero.png'  },
		{ id: 'automovil', label: '🚗 Auto',      file: 'images/automovil.png' },
		{ id: 'perro',     label: '🐕 Perro',     file: 'images/perro.png'     },
		{ id: 'barco',     label: '⛵ Barco',     file: 'images/barco.png'     },
		{ id: 'zapato',    label: '👞 Zapato',    file: 'images/zapato.png'    },
		{ id: 'dedal',     label: '🪣 Dedal',     file: 'images/dedal.png'     },
		{ id: 'plancha',   label: '⚒️ Plancha',  file: 'images/plancha.png'   },
		{ id: 'tren',      label: '🚂 Tren',      file: 'images/train_icon.png'}
	];
	window.__AVATAR_OPTIONS = AVATAR_OPTIONS; // exposed for setup() lookup
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
			try { window.__applyPreset(presetKey); } catch (e) {}
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
		});
	});
	var byId = function (id, fn) {
		var el = document.getElementById(id);
		if (el) el.addEventListener('click', fn);
	};
	byId('start-game-btn',      setup);
	byId('resignbutton',        function () { game.resign(); });
	byId('proposetradebutton',  function () { game.proposeTrade(); });
	byId('canceltradebutton',   function () { game.cancelTrade(); });
	byId('accepttradebutton',   function () { game.acceptTrade(); });
	byId('rejecttradebutton',   function () { game.cancelTrade(); });

	// Edition selector: reflect the active edition, and switch on change.
	var editionSel = document.getElementById('edition-select');
	if (editionSel) {
		editionSel.value = window.__EDITION || 'classic';
		editionSel.addEventListener('change', function () {
			try { window.localStorage.setItem('monopoly:edition', editionSel.value); } catch (e) {}
			window.location.reload();
		});
	}
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

	$("body").on("mousemove", function (e) {
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

	$("body").on("mouseup", function () { drag = false; });

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
	$("#mortgagebutton").click(function () {
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

	$("#buyhousebutton").on("click", function () {
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
	$("#buyhousebutton").on('mouseenter', function () {
		var idx = getCheckedProperty();
		var sq = square[idx];
		if (!sq || sq.owner === 0) return;
		var p = player[sq.owner];
		__showConsequencePreview(this, p.money, -sq.houseprice, 150);
	});
	$("#buyhousebutton").on('mouseleave', __hideConsequencePreview);

	$("#mortgagebutton").on('mouseenter', function () {
		var idx = getCheckedProperty();
		var sq = square[idx];
		if (!sq || sq.owner === 0) return;
		var p = player[sq.owner];
		var delta = sq.mortgage
			? -Math.round(sq.price * 0.55)   // unmortgaging costs 10% interest
			:  Math.round(sq.price * 0.5);   // mortgaging pays out half
		__showConsequencePreview(this, p.money, delta, 200);
	});
	$("#mortgagebutton").on('mouseleave', __hideConsequencePreview);

	$("#sellhousebutton").on('mouseenter', function () {
		var idx = getCheckedProperty();
		var sq = square[idx];
		if (!sq || sq.owner === 0 || (sq.house === 0 && !sq.hotel)) return;
		var p = player[sq.owner];
		__showConsequencePreview(this, p.money, Math.round(sq.houseprice * 0.5));
	});
	$("#sellhousebutton").on('mouseleave', __hideConsequencePreview);

	$("#sellhousebutton").click(function () {
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

	$("#viewstats").on("click", showStats);
	$("#statsclose, #statsbackground").on("click", function () {
		$("#statswrap").hide();
		$("#statsbackground").fadeOut(400);
		// If we opened stats from inside the victory overlay, bring it back.
		if (window.__victoryOverlay && window.__victoryOverlay.parentNode) {
			var ov = window.__victoryOverlay;
			ov.style.visibility = '';
			ov.style.transition = 'opacity 280ms ease-out';
			ov.style.opacity = '0';
			requestAnimationFrame(function () { ov.style.opacity = '1'; });
			setTimeout(function () { ov.style.transition = ''; }, 320);
		}
	});
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
	$("#buy-menu-item").click(function () {
		$("#buy").show(); $("#manage").hide(); $("#trade").hide();
		markActive('buy-menu-item');
		$("#alert").scrollTop($("#alert").prop("scrollHeight"));
	});
	$("#manage-menu-item").click(function () {
		$("#manage").show(); $("#buy").hide(); $("#trade").hide();
		markActive('manage-menu-item');
	});
	$("#trade-menu-item").click(function () {
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
		window.__THEME = mode;
		try { window.localStorage.setItem('monopoly:theme', mode); } catch (e) {}
	}

	apply(window.__THEME || 'auto');
	btn.addEventListener('click', function () {
		var current = window.__THEME || 'auto';
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

window.onload = function() {
	__renderPlayerSetup();
	_initI18N();
	_initThemeToggle();
	_initSettingsMenu();

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
			try { window.localStorage.setItem('monopoly:tourSeen', '1'); } catch (e) {}
		}

		function start() {
			try {
				if (window.localStorage.getItem('monopoly:tourSeen') === '1') return;
			} catch (e) {}
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

	$("#playernumber").on("change", playernumber_onchange);
	playernumber_onchange();

	_wireGlobalButtons();
	$("#nextbutton").click(game.next);

	$("#noscript").hide();
	$("#setup, #noF5").show();

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
	$("<div>", {id: "jailpositionholder" }).appendTo("#jail");
	$("<span>").text(t('place.jail')).appendTo("#jail");

	document.getElementById("jail").enlargeId = "enlarge40";

	document.getElementById("enlarge-wrap").innerHTML += "<div id='enlarge40' class='enlarge'><div id='enlarge40color' class='enlarge-color'></div><br /><div id='enlarge40name' class='enlarge-name'></div><br /><div id='enlarge40price' class='enlarge-price'><img src='images/jake_icon.png' height='80' width='80' alt='' style='position: relative; top: -20px;' /></div><br /><div id='enlarge40token' class='enlarge-token'></div></div>";

	document.getElementById("enlarge40name").textContent = t('place.jail');

	_initDragHandlers();
	_wireManagePanel();
	_wireMoneyBarInteractivity();
	_wireTabSwitchers();
};
