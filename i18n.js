// Minimal i18n: synchronous dictionary lookup, {var} interpolation, localStorage persistence.
// Exposes window.I18N and a global t() helper.
var I18N = (function () {
	var lang = 'en';

	var dict = {
		en: {
			// UI buttons
			'ui.rollDice': 'Roll Dice',
			'ui.rollDiceTitle': 'Roll the dice and move your token accordingly. (Space)',
			'ui.gameOn': 'GAME ON',
			'ui.winnerLabel': 'WINNER',
			'ui.victorySub': '{player} has bankrupted everyone else.',
			'ui.playAgain': 'Play Again',
			'ui.endTurn': 'End turn',
			'ui.endTurnTitle': 'End turn and advance to the next player. (Enter)',
			'ui.rollAgain': 'Roll again',
			'ui.rollAgainTitle': 'You threw doubles. Roll again.',
			'ui.resign': 'Resign',
			'ui.resignTitle': 'If you cannot pay your debt then you must resign from the game.',
			'ui.buy': 'Buy',
			'ui.buyFor': 'Buy (${price})',
			'ui.auctionNow': 'Auction',
			'ui.auctionNowTitle': "Don't want to buy? Start an auction so other players can bid.",
			'ui.buyTitle': 'Buy {place} for {pricetext}.',
			'ui.viewStats': 'View stats',
			'ui.viewStatsTitle': "View a pop-up window that shows a list of each player's properties. (S)",
			'ui.startGame': 'Start Game',
			'ui.startGameTitle': 'Begin playing.',
			'ui.payFineButton': 'Pay $50 fine',
			'ui.payFineTitle': 'Pay $50 fine to get out of jail immediately.',
			'ui.useCard': 'Use Card',
			'ui.useCardTitle': 'Use "Get Out of Jail Free" card.',
			'ui.ok': 'OK',
			'ui.yes': 'Yes',
			'ui.no': 'No',
			'ui.bid': 'Bid',
			'ui.themeToggle': 'Theme: {mode}. Click to cycle (Auto → Light → Dark).',
			'ui.themeAuto': 'auto',
			'ui.themeLight': 'light',
			'ui.themeDark': 'dark',
			'ui.settingsTitle': 'Settings',
			'ui.settingsLanguage': 'Language',
			'ui.settingsSound': 'Sound',
			'ui.settingsTheme': 'Theme',
			'ui.settingsHelp': 'Help',
			'ui.autoAcceptLabel': 'Auto-accepting in…',
			'ui.autoAcceptHint': 'Click anywhere on the popup to cancel.',
			'ui.autoRollLabel': 'Auto-roll in',
			'ui.autoRollHint': 'Move or click the dice to cancel.',
			'ui.bidTitle': 'Place your bid.',
			'ui.pass': 'Pass',
			'ui.passTitle': 'Skip bidding this time.',
			'ui.exitAuction': 'Exit Auction',
			'ui.exitAuctionTitle': 'Stop bidding on {place} altogether.',
			'ui.proposeTrade': 'Propose Trade',
			'ui.proposeTradeTitle': 'Exchange the money and properties that are checked above.',
			'ui.cancelTrade': 'Cancel Trade',
			'ui.cancelTradeTitle': 'Cancel the trade.',
			'ui.acceptTrade': 'Accept Trade',
			'ui.acceptTradeTitle': 'Accept the proposed trade.',
			'ui.rejectTrade': 'Reject Trade',
			'ui.rejectTradeTitle': 'Reject the proposed trade.',
			'ui.buyHouse': 'Buy house',
			'ui.mortgage': 'Mortgage',
			'ui.sellHouse': 'Sell house',
			'ui.close': 'Close',
			'ui.closeEsc': 'Close (Esc)',
			'ui.pressEscToClose': 'Press Esc to close',
			'help.escCloseTitle': 'Close (Esc)',
			'trade.moneyPlaceholder': '$0',
			'ui.pay200': 'Pay $200',
			'ui.payPercent': 'Pay 10%',

			// Menu tabs
			'menu.buy': 'Buy',
			'menu.buyTitle': 'View alerts and buy the property you landed on.',
			'menu.manage': 'Manage',
			'menu.manageTitle': 'View, mortgage, and improve your property.',
			'menu.trade': 'Trade',
			'menu.tradeTitle': 'Exchange property with other players.',

			// Setup
			'setup.selectPlayers': 'Select number of players.',
			'setup.numPlayersTitle': 'Select the number of players for the game.',
			'setup.playerLabel': 'Player {n}:',
			'setup.playerName': 'Player name',
			'setup.playerColor': 'Player color',
			'setup.playerAvatar': 'Pick a token',
			'setup.playerAi': 'Choose whether this player is controlled by a human or by the computer.',
			'setup.human': 'Human',
			'setup.aiTest': 'AI (Test)',
			'setup.aiEasy': 'AI (Easy)',
			'setup.aiNormal': 'AI (Normal)',
			'setup.aiHard': 'AI (Hard)',
			'setup.aiAdaptive': 'AI (Adaptive)',
			'trade.summaryGive': 'You give:',
			'trade.summaryGet': 'You get:',
			'trade.summaryNet': 'Net cash',
			'trade.summaryEmpty': 'Tick at least one property to preview the trade.',
			'auction.bidPreviewTitle': 'After this bid',
			'ui.skipToBoard': 'Skip to game board',
			'landed.justVisiting': 'Visiting',
			'audio.warming': 'Audio loading…',
			'setup.noF5': 'Note: Refreshing this page or navigating away from it may end your game without warning.',
			'setup.noJS': 'Note: This page will not function without JavaScript.',
			'setup.refresh': 'Refresh this page to start a new game.',

			// Deed
			'deed.titleDeed': 'T I T L E  D E E D',
			'deed.price': 'PRICE',
			'deed.rent': 'RENT',
			'deed.currentRent': 'Current rent',
			'deed.ownerLabel': 'Owner',
			'deed.unowned': 'Unowned · for sale',
			'deed.base': 'base',
			'deed.monopolyDouble': '×2 monopoly',
			'deed.houseSingular': 'House',
			'deed.housePlural': 'Houses',
			'deed.with1House': 'With 1 House',
			'deed.with2Houses': 'With 2 Houses',
			'deed.with3Houses': 'With 3 Houses',
			'deed.with4Houses': 'With 4 Houses',
			'deed.withHotel': 'With HOTEL',
			'deed.mortgageValue': 'Mortgage Value',
			'deed.housesCost': 'Houses cost ${price}. each',
			'deed.hotelsCost': 'Hotels, ${price}. plus 4 houses',
			'deed.groupRule': 'If a player owns ALL the Lots of any Color-Group, the rent is Doubled on Unimproved Lots in that group.',
			'deed.mortgaged': 'MORTGAGED',
			'deed.mortgagedFor': 'for ${amount}',
			'deed.mortgagedForPrefix': 'for',
			'deed.mortgagedNote': 'Card must be turned this side up if property is mortgaged',

			// Alerts
			'alert.landedOn': '{player} landed on {place}.',
			'alert.rolled': '{player} rolled {n}.',
			'alert.rolledDoubles': '{player} rolled {n} - doubles.',
			'alert.tripleDoubles': '{player} rolled doubles three times in a row.',
			'alert.doublesOutOfJail': '{player} rolled doubles to get out of jail.',
			'alert.firstTurnInJail': "This is {player}'s first turn in jail.",
			'alert.secondTurnInJail': "This is {player}'s second turn in jail.",
			'alert.thirdTurnInJail': "This is {player}'s third turn in jail.",
			'alert.usedJailCard': '{player} used a "Get Out of Jail Free" card.',
			'alert.tradeInitiated': '{initiator} initiated a trade with {recipient}.',
			'alert.receivedProperty': '{recipient} received {place} from {initiator}.',
			'alert.receivedJailCard': '{recipient} received a "Get Out of Jail Free" card from {initiator}.',
			'alert.receivedMoneyFrom': '{recipient} received ${amount} from {initiator}.',
			'alert.sentToJail': '{player} was sent directly to jail.',
			'alert.boughtProperty': '{player} bought {place} for ${price}.',
			'alert.paidRent': '{player} paid ${amount} rent to {owner}.',
			'alert.collectedSalary': '{player} collected a $200 salary for passing GO.',
			'alert.isYourTurn': "It is {player}'s turn.",
			'alert.bankrupt': '{player} is bankrupt.',
			'alert.received': '{player} received ${amount} from {cause}.',
			'alert.lost': '{player} lost ${amount} from {cause}.',
			'alert.placedHouse': '{player} placed a house on {place}.',
			'alert.placedHotel': '{player} placed a hotel on {place}.',
			'alert.soldHouse': '{player} sold a house on {place}.',
			'alert.soldHotel': '{player} sold the hotel on {place}.',
			'alert.mortgaged': '{player} mortgaged {place} for ${amount}.',
			'alert.unmortgaged': '{player} unmortgaged {place} for ${amount}.',
			'alert.paidCityTax': '{player} paid $200 for landing on City Tax.',
			'alert.paidLuxuryTax': '{player} paid ${amount} for landing on Luxury Tax.',
			'alert.paidFine': '{player} paid the $50 fine to get out of jail.',
			'alert.exitedAuction': '{player} exited the auction.',
			'alert.passedAuction': '{player} passed.',
			'alert.bidAmount': '{player} bid ${amount}.',
			'alert.bankruptcyInterest': '{recipient} paid ${amount} interest on the mortgaged properties received from {player}.',

			// Landed
			'landed.youLandedOn': 'You landed on {place}.',
			'landed.buyOrAuctionHint': 'Tip: if you don\'t buy, the property auctions when your turn ends.',
			'landed.youLandedRent': 'You landed on {place}. {owner} collected ${amount} rent.',
			'landed.youLandedMortgaged': 'You landed on {place}. Property is mortgaged; no rent was collected.',
			'landed.cityTax': 'You landed on City Tax. Pay $200.',
			'landed.luxuryTax': 'You landed on Luxury Tax. Pay ${amount}.',
			'landed.inJail': 'You are in jail.',

			// Popups
			'popup.gotoJailMsg': 'Go to jail. Go directly to Jail. Do not pass GO. Do not collect $200.',
			'popup.tripleDoublesMsg': 'You rolled doubles three times in a row. Go to jail.',
			'popup.payFineMsg': 'You must pay the $50 fine.',
			'popup.bankrupt': '{player} is bankrupt. All of its assets will be turned over to {creditor}.',
			'popup.won': 'Congratulations, {player}, you have won the game.',
			'popup.mortgageConfirm': '{player}, are you sure you want to mortgage {place} for ${amount}?',
			'popup.unmortgageConfirm': '{player}, are you sure you want to unmortgage {place} for ${amount}?',
			'popup.unmortgageShort': 'You need ${amount} more to unmortgage {place}.',
			'popup.needForHouse': 'You need ${amount} more to buy a house for {place}.',
			'popup.needForHotel': 'You need ${amount} more to buy a hotel for {place}.',
			'popup.allHousesOwned': 'All 32 houses are owned. You must wait until one becomes available.',
			'popup.allHotelsOwned': 'All 12 hotels are owned. You must wait until one becomes available.',
			'popup.resignConfirm': 'Are you sure you want to resign?',
			'popup.resignDetails': 'You will lose {count} properties (≈${value} in assets), all going to {recipient}, and you will be eliminated from the game.',
			'popup.resignDetails.zero': "You won't lose any property (≈${value} in assets), all going to {recipient}, and you will be eliminated from the game.",
			'popup.resignDetails.one': 'You will lose 1 property (≈${value} in assets), going to {recipient}, and you will be eliminated from the game.',
			'popup.resignDetails.other': 'You will lose {count} properties (≈${value} in assets), all going to {recipient}, and you will be eliminated from the game.',
			'popup.resignBank': 'the bank',
			'popup.confirmSellHotel': 'Selling the hotel on {place} will drop your rent there significantly. Continue?',
			'popup.confirmSellLast': 'This is the last building in a complete color group. Selling it cuts rent back to the base amount. Continue?',
			'popup.payInterest': '{recipient}, you must pay ${amount} interest on the mortgaged properties you received from {player}.',
			'popup.confirmExitAuction': 'Are you sure you want to stop bidding on this property altogether?',
			'popup.cityTaxChoice': 'You landed on City Tax. You must pay $200 or ten percent of your total worth.',
			'popup.tradeConfirm': '{initiator}, are you sure you want to make this exchange with {recipient}?',
			'auction.title': 'Auction',
			'auction.highestBid': 'Highest Bid',
			'auction.na': 'N/A',
			'auction.yourTurn': '{player}, it is your turn to bid.',
			'auction.yourTurnLabel': 'Now bidding',
			'auction.cashLabel': 'Cash',
			'auction.bidPlaceholder': 'Enter an amount to bid on {place}.',
			'auction.statusCurrent': 'their turn',
			'auction.statusHighest': 'leading',
			'auction.statusWaiting': 'waiting',
			'auction.statusOut': 'out',
			'auction.enterBid': 'Please enter a bid.',
			'auction.bidNumeric': 'Your bid must be a number.',
			'auction.bidNotEnough': "You don't have enough money to bid ${bid}.",
			'manage.unmortgageValue': 'Unmortgage (${amount})',
			'manage.unmortgageTitle': 'Unmortgage {place} for ${amount}.',
			'place.jail': 'Jail',
			'trade.invalidNumber': 'This value must be a number.',
			'trade.notEnoughMoney': '{player} does not have ${amount}.',
			'popup.tradeOfferConfirm': '{initiator}, are you sure you want to make this offer to {recipient}?',
			'stats.mortgagedTooltip': 'Mortgaged',
			'stats.hotelTooltip': 'Hotel',
			'stats.houseTooltip': 'House',
			'stats.gojfCard': 'Get Out of Jail Free Card',
			'stats.noProperties': "{player} doesn't have any properties.",
			'trade.includePropertyTitle': 'Check this box to include {place} in the trade.',
			'trade.includeCardTitle': 'Check this box to include this Get Out of Jail Free Card in the trade.',
			'trade.noProperties': '{player} has no properties to trade.',
			'trade.selectPlayerTitle': 'Select a player to trade with.',
			'manage.mortgageValue': 'Mortgage (${amount})',
			'manage.mortgageTitle': 'Mortgage {place} for ${amount}.',
			'manage.buyHouseValue': 'Buy house (${amount})',
			'manage.buyHotelValue': 'Buy hotel (${amount})',
			'manage.sellHouseValue': 'Sell house (${amount})',
			'manage.sellHotelValue': 'Sell hotel (${amount})',
			'manage.buyHouseTitle': 'Buy a house for ${amount}',
			'manage.buyHotelTitle': 'Buy a hotel for ${amount}',
			'manage.sellHouseTitle': 'Sell a house for ${amount}',
			'manage.sellHotelTitle': 'Sell a hotel for ${amount}',
			'manage.needOwnGroup': 'Before you can buy a house, you must own all the properties of this color-group.',
			'manage.needUnmortgage': 'Before you can buy a house, you must unmortgage all the properties of this color-group.',
			'manage.needOneEach': 'Before you can buy another house, the other properties of this color-group must all have one house.',
			'manage.need4Each': 'Before you can buy a hotel, the other properties of this color-group must all have 4 houses.',
			'manage.needNEach': 'Before you can buy a house, the other properties of this color-group must all have {n} houses.',
			'manage.sellNeedOne': 'Before you can sell a house, the other properties of this color-group must all have one house.',
			'manage.sellNeedN': 'Before you can sell a house, the other properties of this color-group must all have {n} houses.',
			'manage.mortgageNeedUnimproved': 'Before a property can be mortgaged, all the properties of its color-group must be unimproved.',
			'popup.tradeNoProperties': 'One or more properties must be selected in order to trade.',
			'popup.tradeProposed': '{initiator} has proposed a trade with you, {recipient}. You may accept, reject, or modify the offer.',
			'popup.tradeAccepted': '{recipient} has accepted your offer.',
			'popup.tradeDeclined': '{recipient} has declined your offer.',
			'popup.tradeCounter': '{recipient} has proposed a counteroffer.',
			'popup.bankruptcyUnmortgageNote': '{recipient}, you may unmortgage any of the following properties, interest free, by clicking on them. Click OK when finished.',
			'popup.unmortgageProp': 'Unmortgage {place} (${amount})',
			'popup.unmortgageTitle': 'Unmortgage {place} for ${amount}.',

			// Common
			'common.thebank': 'the bank',
			'cc.title': 'Community Chest:',
			'chance.title': 'Chance:',
			'source.cc': 'Community Chest',
			'source.chance': 'Chance',

			// Community Chest cards
			'cc.0': 'Get out of Jail, Free. This card may be kept until needed or sold.',
			'cc.1': 'You have won second prize in a beauty contest. Collect $10.',
			'cc.2': 'From sale of stock, you get $50.',
			'cc.3': 'Life insurance matures. Collect $100.',
			'cc.4': 'Income tax refund. Collect $20.',
			'cc.5': 'Holiday fund matures. Receive $100.',
			'cc.6': 'You inherit $100.',
			'cc.7': 'Receive $25 consultancy fee.',
			'cc.8': 'Pay hospital fees of $100.',
			'cc.9': 'Bank error in your favor. Collect $200.',
			'cc.10': 'Pay school fees of $50.',
			'cc.11': "Doctor's fee. Pay $50.",
			'cc.12': 'It is your birthday. Collect $10 from every player.',
			'cc.13': 'Advance to "GO" (Collect $200).',
			'cc.14': 'You are assessed for street repairs. $40 per house. $115 per hotel.',
			'cc.15': 'Go to Jail. Go directly to Jail. Do not pass "GO". Do not collect $200.',

			// Chance cards
			'chance.0': 'GET OUT OF JAIL FREE. This card may be kept until needed or traded.',
			'chance.1': 'Make General Repairs on All Your Property. For each house pay $25. For each hotel $100.',
			'chance.2': 'Speeding fine $15.',
			'chance.3': 'You have been elected chairman of the board. Pay each player $50.',
			'chance.4': 'Go back three spaces.',
			'chance.5': 'ADVANCE TO THE NEAREST UTILITY. IF UNOWNED, you may buy it from the Bank. IF OWNED, throw dice and pay owner a total ten times the amount thrown.',
			'chance.6': 'Bank pays you dividend of $50.',
			'chance.7': 'ADVANCE TO THE NEAREST RAILROAD. If UNOWNED, you may buy it from the Bank. If OWNED, pay owner twice the rental to which they are otherwise entitled.',
			'chance.8': 'Pay poor tax of $15.',
			'chance.9': 'Take a trip to Reading Rail Road. If you pass "GO" collect $200.',
			'chance.10': 'ADVANCE to Boardwalk.',
			'chance.11': 'ADVANCE to Illinois Avenue. If you pass "GO" collect $200.',
			'chance.12': 'Your building loan matures. Collect $150.',
			'chance.13': 'ADVANCE TO THE NEAREST RAILROAD. If UNOWNED, you may buy it from the Bank. If OWNED, pay owner twice the rental to which they are otherwise entitled.',
			'chance.14': 'ADVANCE to St. Charles Place. If you pass "GO" collect $200.',
			'chance.15': 'Go to Jail. Go Directly to Jail. Do not pass "GO". Do not collect $200.',

			// Help modal
			'help.openTitle': 'Help & rules (?)',
			'help.title': 'How to play',
			'help.shortcutsTitle': 'Keyboard shortcuts',
			'help.kbdSpace': 'Space',
			'help.kbdRollDesc': 'Roll dice / Start game',
			'help.kbdEnterDesc': 'End turn / confirm primary action',
			'help.kbdBDesc': 'Buy tab',
			'help.kbdMDesc': 'Manage tab',
			'help.kbdTDesc': 'Trade tab',
			'help.kbdSDesc': 'View stats',
			'help.kbdHelpDesc': 'Open this help',
			'help.kbdEscDesc': 'Close modal',
			'help.rulesTitle': 'Quick rules',
			'help.ruleRoll': 'Roll dice on your turn. Your token walks to the destination cell-by-cell.',
			'help.ruleBuy': 'If you land on an unowned property, you can buy it for the listed price.',
			'help.ruleRent': 'If you land on an owned property, you pay rent. Rent doubles on full color groups, then increases with houses (1→4) and a hotel.',
			'help.ruleBuild': 'Once you own a full color group, you can build houses. You must build evenly across the group.',
			'help.ruleJail': 'Three doubles in a row, or landing on "Go to Jail", sends you to jail. Pay $50 or roll doubles to leave.',
			'help.ruleGo': 'Pass GO to collect $200.',
			'help.ruleWin': 'Last player not bankrupt wins.',
			'help.tipsTitle': 'Tips',
			'help.tipHover': 'Hover any property on the board to see its title deed with current rent and owner.',
			'help.tipMonopoly': 'Owning a full color group doubles rent immediately, even with zero houses.',
			'help.tipCash': "Keep a cash buffer — landing on someone else's hotel can wipe you out.",
			'help.tipMortgage': 'Mortgaging gives you half the price back. Unmortgaging costs 10% interest.',

			// Onboarding tour
			'tour.skip':   'Skip',
			'tour.next':   'Next',
			'tour.finish': 'Got it',
			'tour.s1.title': 'Roll the dice',
			'tour.s1.body':  'This is your main action. Click it (or press Space) to roll and move your token.',
			'tour.s2.title': 'The board',
			'tour.s2.body':  'Hover any property to see its title deed. Land on one and you can buy it.',
			'tour.s3.title': 'Money & players',
			'tour.s3.body':  "Each player's cash is here. The active player's row is highlighted.",
			'tour.s4.title': 'Need help?',
			'tour.s4.body':  'Open this anytime for the full rules and keyboard shortcuts. Have fun!',

			// Consequence preview tooltip
			'preview.current': 'Now',
			'preview.after':   'After',
			'preview.cantAfford': "You can't afford this.",
			'preview.lowCash': 'Low cash buffer.',

			// Money bar
			'mb.propsTitle': 'Properties owned',
			'mb.netWorthTitle': 'Net worth (cash + property + buildings)',

			// Side panel sections
			'panel.playersLabel': 'Players · Bank',
			'panel.actionsLabel': 'Your turn · Actions',
			'panel.upNext': 'Up next:',
			'panel.aiThinking': '⏳ {player} is thinking…',
			'panel.aiRecapTitle': 'Turn summary',

			// Board edition selector
			'setup.editionLabel': 'Board edition:',
			'setup.editionTitle': 'Pick a board layout. Switching reloads the page.',
			'setup.editionClassic': 'Classic',
			'setup.editionNYC': 'New York City',

			// Setup presets
			'setup.presetsTitle': 'Choose a starting profile',
			'setup.presetQuick': 'Quick',
			'setup.presetQuickSub': '$1000 · faster',
			'setup.presetStandard': 'Standard',
			'setup.presetStandardSub': '$1500 · classic',
			'setup.presetLong': 'Long',
			'setup.presetLongSub': '$2500 · marathon',

			// House rules
			'setup.houseRulesTitle': 'House rules (optional)',
			'setup.ruleFP':        'Free Parking jackpot',
			'setup.ruleFPSub':     'Taxes + fines pile up; landing on Free Parking wins the pot.',
			'setup.ruleSnake':     'Snake-eyes bonus',
			'setup.ruleSnakeSub':  'Rolling double 1s pays $500.',
			'setup.ruleDoubleGo':  'Double GO',
			'setup.ruleDoubleGoSub': 'Landing exactly on GO pays $400 instead of $200.',
			'setup.ruleNoAuc':     'No auctions',
			'setup.ruleNoAucSub':  'Unbought properties return to the bank.',
			'setup.ruleSpeed':     'Speed mode',
			'setup.ruleSpeedSub':  'All animations 2× faster.',

			// House-rule alerts
			'alert.snakeEyes':     '🎲 {player} rolled snake eyes — bonus $500!',
			'alert.doubleGo':     '💰 {player} landed exactly on GO — double salary ($400)!',
			'alert.freeParkingWin': '🅿️ {player} hit the Free Parking jackpot — ${amount}!',
			'landed.noAuctionHint': 'Tip: if you don\'t buy, the property returns to the bank.',
			'ui.careerWins':       '🏆 {count} career wins',
			'ui.careerWins.one':   '🏆 1 career win',
			'ui.careerWins.other': '🏆 {count} career wins'
		},
		es: {
			'ui.rollDice': 'Tirar dados',
			'ui.rollDiceTitle': 'Tira los dados y mueve tu ficha. (Espacio)',
			'ui.gameOn': 'A JUGAR',
			'ui.winnerLabel': 'GANADOR',
			'ui.victorySub': '{player} ha llevado a la quiebra a todos los demás.',
			'ui.playAgain': 'Jugar de nuevo',
			'ui.endTurn': 'Terminar turno',
			'ui.endTurnTitle': 'Terminar turno y pasar al siguiente jugador. (Enter)',
			'ui.rollAgain': 'Tirar de nuevo',
			'ui.rollAgainTitle': 'Sacaste dobles. Tira de nuevo.',
			'ui.resign': 'Rendirse',
			'ui.resignTitle': 'Si no puedes pagar tu deuda debes rendirte de la partida.',
			'ui.buy': 'Comprar',
			'ui.buyFor': 'Comprar (${price})',
			'ui.auctionNow': 'Subastar',
			'ui.auctionNowTitle': '¿No quieres comprarla? Empieza una subasta para que otros pujen.',
			'ui.buyTitle': 'Comprar {place} por {pricetext}.',
			'ui.viewStats': 'Ver estad.',
			'ui.viewStatsTitle': 'Abrir una ventana con la lista de propiedades de cada jugador. (S)',
			'ui.startGame': 'Empezar partida',
			'ui.startGameTitle': 'Comenzar a jugar.',
			'ui.payFineButton': 'Pagar multa $50',
			'ui.payFineTitle': 'Pagar multa de $50 para salir de la cárcel inmediatamente.',
			'ui.useCard': 'Usar carta',
			'ui.useCardTitle': 'Usar carta "Salida gratis de la cárcel".',
			'ui.ok': 'OK',
			'ui.yes': 'Sí',
			'ui.no': 'No',
			'ui.bid': 'Pujar',
			'ui.themeToggle': 'Tema: {mode}. Pulsa para cambiar (Auto → Claro → Oscuro).',
			'ui.themeAuto': 'auto',
			'ui.themeLight': 'claro',
			'ui.themeDark': 'oscuro',
			'ui.settingsTitle': 'Configuración',
			'ui.settingsLanguage': 'Idioma',
			'ui.settingsSound': 'Sonido',
			'ui.settingsTheme': 'Tema',
			'ui.settingsHelp': 'Ayuda',
			'ui.autoAcceptLabel': 'Se acepta solo en…',
			'ui.autoAcceptHint': 'Pulsa cualquier botón para cancelar.',
			'ui.autoRollLabel': 'Tirada automática en',
			'ui.autoRollHint': 'Mueve o pulsa los dados para cancelar.',
			'ui.bidTitle': 'Realizar puja.',
			'ui.pass': 'Pasar',
			'ui.passTitle': 'Saltar esta puja.',
			'ui.exitAuction': 'Salir subasta',
			'ui.exitAuctionTitle': 'Dejar de pujar por {place} totalmente.',
			'ui.proposeTrade': 'Proponer trato',
			'ui.proposeTradeTitle': 'Intercambiar dinero y propiedades marcadas.',
			'ui.cancelTrade': 'Cancelar trato',
			'ui.cancelTradeTitle': 'Cancelar el intercambio.',
			'ui.acceptTrade': 'Aceptar trato',
			'ui.acceptTradeTitle': 'Aceptar el intercambio propuesto.',
			'ui.rejectTrade': 'Rechazar trato',
			'ui.rejectTradeTitle': 'Rechazar el intercambio propuesto.',
			'ui.buyHouse': 'Comprar casa',
			'ui.mortgage': 'Hipotecar',
			'ui.sellHouse': 'Vender casa',
			'ui.close': 'Cerrar',
			'ui.closeEsc': 'Cerrar (Esc)',
			'ui.pressEscToClose': 'Presiona Esc para cerrar',
			'help.escCloseTitle': 'Cerrar (Esc)',
			'trade.moneyPlaceholder': '$0',
			'ui.pay200': 'Pagar $200',
			'ui.payPercent': 'Pagar 10%',

			'menu.buy': 'Comprar',
			'menu.buyTitle': 'Ver alertas y comprar la propiedad en la que caíste.',
			'menu.manage': 'Gestionar',
			'menu.manageTitle': 'Ver, hipotecar y mejorar tus propiedades.',
			'menu.trade': 'Intercambiar',
			'menu.tradeTitle': 'Intercambiar propiedades con otros jugadores.',

			'setup.selectPlayers': 'Selecciona el número de jugadores.',
			'setup.numPlayersTitle': 'Selecciona el número de jugadores de la partida.',
			'setup.playerLabel': 'Jugador {n}:',
			'setup.playerName': 'Nombre del jugador',
			'setup.playerColor': 'Color del jugador',
			'setup.playerAvatar': 'Elige una ficha',
			'setup.playerAi': 'Elige si este jugador es humano o controlado por la computadora.',
			'setup.human': 'Humano',
			'setup.aiTest': 'IA (Prueba)',
			'setup.aiEasy': 'IA (Fácil)',
			'setup.aiNormal': 'IA (Normal)',
			'setup.aiHard': 'IA (Difícil)',
			'setup.aiAdaptive': 'IA (Adaptativa)',
			'trade.summaryGive': 'Das:',
			'trade.summaryGet': 'Recibes:',
			'trade.summaryNet': 'Neto',
			'trade.summaryEmpty': 'Marca al menos una propiedad para previsualizar el intercambio.',
			'auction.bidPreviewTitle': 'Después de esta puja',
			'ui.skipToBoard': 'Saltar al tablero',
			'landed.justVisiting': 'De visita',
			'audio.warming': 'Cargando audio…',
			'setup.noF5': 'Aviso: Recargar la página o salir de ella puede terminar tu partida sin previo aviso.',
			'setup.noJS': 'Aviso: Esta página no funciona sin JavaScript.',
			'setup.refresh': 'Recarga esta página para empezar una partida nueva.',

			'deed.titleDeed': 'T Í T U L O  D E  P R O P I E D A D',
			'deed.price': 'PRECIO',
			'deed.rent': 'ALQUILER',
			'deed.currentRent': 'Alquiler actual',
			'deed.ownerLabel': 'Dueño',
			'deed.unowned': 'Sin dueño · en venta',
			'deed.base': 'base',
			'deed.monopolyDouble': '×2 por monopolio',
			'deed.houseSingular': 'Casa',
			'deed.housePlural': 'Casas',
			'deed.with1House': 'Con 1 Casa',
			'deed.with2Houses': 'Con 2 Casas',
			'deed.with3Houses': 'Con 3 Casas',
			'deed.with4Houses': 'Con 4 Casas',
			'deed.withHotel': 'Con HOTEL',
			'deed.mortgageValue': 'Valor de Hipoteca',
			'deed.housesCost': 'Casas cuestan ${price}. cada una',
			'deed.hotelsCost': 'Hoteles, ${price}. más 4 casas',
			'deed.groupRule': 'Si un jugador posee TODOS los solares de un grupo de color, el alquiler se duplica en los solares no mejorados de ese grupo.',
			'deed.mortgaged': 'HIPOTECADA',
			'deed.mortgagedFor': 'por ${amount}',
			'deed.mortgagedForPrefix': 'por',
			'deed.mortgagedNote': 'La carta debe ponerse con este lado hacia arriba si la propiedad está hipotecada',

			'alert.landedOn': '{player} cayó en {place}.',
			'alert.rolled': '{player} tiró {n}.',
			'alert.rolledDoubles': '{player} tiró {n} - dobles.',
			'alert.tripleDoubles': '{player} sacó dobles tres veces seguidas.',
			'alert.doublesOutOfJail': '{player} sacó dobles y sale de la cárcel.',
			'alert.firstTurnInJail': 'Es el primer turno de {player} en la cárcel.',
			'alert.secondTurnInJail': 'Es el segundo turno de {player} en la cárcel.',
			'alert.thirdTurnInJail': 'Es el tercer turno de {player} en la cárcel.',
			'alert.usedJailCard': '{player} usó una carta de Salida Gratis de la Cárcel.',
			'alert.tradeInitiated': '{initiator} inició un trato con {recipient}.',
			'alert.receivedProperty': '{recipient} recibió {place} de {initiator}.',
			'alert.receivedJailCard': '{recipient} recibió una carta de Salida Gratis de la Cárcel de {initiator}.',
			'alert.receivedMoneyFrom': '{recipient} recibió ${amount} de {initiator}.',
			'alert.sentToJail': '{player} fue enviado directamente a la cárcel.',
			'alert.boughtProperty': '{player} compró {place} por ${price}.',
			'alert.paidRent': '{player} pagó ${amount} de alquiler a {owner}.',
			'alert.collectedSalary': '{player} cobró $200 de salario al pasar por SALIDA.',
			'alert.isYourTurn': 'Es el turno de {player}.',
			'alert.bankrupt': '{player} está en bancarrota.',
			'alert.received': '{player} recibió ${amount} de {cause}.',
			'alert.lost': '{player} perdió ${amount} por {cause}.',
			'alert.placedHouse': '{player} colocó una casa en {place}.',
			'alert.placedHotel': '{player} colocó un hotel en {place}.',
			'alert.soldHouse': '{player} vendió una casa en {place}.',
			'alert.soldHotel': '{player} vendió el hotel en {place}.',
			'alert.mortgaged': '{player} hipotecó {place} por ${amount}.',
			'alert.unmortgaged': '{player} deshipotecó {place} por ${amount}.',
			'alert.paidCityTax': '{player} pagó $200 por caer en Impuesto Municipal.',
			'alert.paidLuxuryTax': '{player} pagó ${amount} por caer en Impuesto de Lujo.',
			'alert.paidFine': '{player} pagó la multa de $50 para salir de la cárcel.',
			'alert.exitedAuction': '{player} se retiró de la subasta.',
			'alert.passedAuction': '{player} pasó.',
			'alert.bidAmount': '{player} pujó ${amount}.',
			'alert.bankruptcyInterest': '{recipient} pagó ${amount} de interés por las propiedades hipotecadas recibidas de {player}.',

			'landed.youLandedOn': 'Caíste en {place}.',
			'landed.buyOrAuctionHint': 'Tip: si no compras, la propiedad va a subasta al terminar tu turno.',
			'landed.youLandedRent': 'Caíste en {place}. {owner} cobró ${amount} de alquiler.',
			'landed.youLandedMortgaged': 'Caíste en {place}. La propiedad está hipotecada; no se cobró alquiler.',
			'landed.cityTax': 'Caíste en Impuesto Municipal. Paga $200.',
			'landed.luxuryTax': 'Caíste en Impuesto de Lujo. Paga ${amount}.',
			'landed.inJail': 'Estás en la cárcel.',

			'popup.gotoJailMsg': 'Vas a la cárcel. Ve directamente a la cárcel. No pases por SALIDA. No cobres $200.',
			'popup.tripleDoublesMsg': 'Sacaste dobles tres veces seguidas. Vas a la cárcel.',
			'popup.payFineMsg': 'Debes pagar la multa de $50.',
			'popup.bankrupt': '{player} está en bancarrota. Todos sus bienes pasarán a {creditor}.',
			'popup.won': '¡Felicidades, {player}! Has ganado la partida.',
			'popup.mortgageConfirm': '{player}, ¿seguro que quieres hipotecar {place} por ${amount}?',
			'popup.unmortgageConfirm': '{player}, ¿seguro que quieres deshipotecar {place} por ${amount}?',
			'popup.unmortgageShort': 'Necesitas ${amount} más para deshipotecar {place}.',
			'popup.needForHouse': 'Necesitas ${amount} más para comprar una casa en {place}.',
			'popup.needForHotel': 'Necesitas ${amount} más para comprar un hotel en {place}.',
			'popup.allHousesOwned': 'Las 32 casas están en uso. Debes esperar a que se libere alguna.',
			'popup.allHotelsOwned': 'Los 12 hoteles están en uso. Debes esperar a que se libere alguno.',
			'popup.resignConfirm': '¿Seguro que quieres rendirte?',
			'popup.resignDetails': 'Vas a perder {count} propiedades (≈${value} en activos), todo pasa a manos de {recipient}, y quedarás eliminado de la partida.',
			'popup.resignDetails.zero': 'No perderás ninguna propiedad (≈${value} en activos), todo pasa a manos de {recipient}, y quedarás eliminado de la partida.',
			'popup.resignDetails.one': 'Vas a perder 1 propiedad (≈${value} en activos), pasa a manos de {recipient}, y quedarás eliminado de la partida.',
			'popup.resignDetails.other': 'Vas a perder {count} propiedades (≈${value} en activos), todo pasa a manos de {recipient}, y quedarás eliminado de la partida.',
			'popup.resignBank': 'el banco',
			'popup.confirmSellHotel': 'Vender el hotel de {place} reducirá significativamente el alquiler. ¿Continuar?',
			'popup.confirmSellLast': 'Es el último edificio del grupo de color completo. Si lo vendes, el alquiler vuelve al valor base. ¿Continuar?',
			'popup.payInterest': '{recipient}, debes pagar ${amount} de interés por las propiedades hipotecadas recibidas de {player}.',
			'popup.confirmExitAuction': '¿Seguro que quieres dejar de pujar por esta propiedad?',
			'popup.cityTaxChoice': 'Caíste en Impuesto Municipal. Debes pagar $200 o el diez por ciento de tu patrimonio total.',
			'popup.tradeConfirm': '{initiator}, ¿seguro que quieres hacer este intercambio con {recipient}?',
			'auction.title': 'Subasta',
			'auction.highestBid': 'Puja más alta',
			'auction.na': 'N/D',
			'auction.yourTurn': '{player}, es tu turno de pujar.',
			'auction.yourTurnLabel': 'Puja ahora',
			'auction.cashLabel': 'Dinero',
			'auction.bidPlaceholder': 'Introduce una cantidad para pujar por {place}.',
			'auction.statusCurrent': 'su turno',
			'auction.statusHighest': 'va ganando',
			'auction.statusWaiting': 'esperando',
			'auction.statusOut': 'fuera',
			'auction.enterBid': 'Por favor, introduce una puja.',
			'auction.bidNumeric': 'Tu puja debe ser un número.',
			'auction.bidNotEnough': 'No tienes suficiente dinero para pujar ${bid}.',
			'manage.unmortgageValue': 'Deshipotecar (${amount})',
			'manage.unmortgageTitle': 'Deshipotecar {place} por ${amount}.',
			'place.jail': 'Cárcel',
			'trade.invalidNumber': 'Este valor debe ser un número.',
			'trade.notEnoughMoney': '{player} no tiene ${amount}.',
			'popup.tradeOfferConfirm': '{initiator}, ¿seguro que quieres hacer esta oferta a {recipient}?',
			'stats.mortgagedTooltip': 'Hipotecada',
			'stats.hotelTooltip': 'Hotel',
			'stats.houseTooltip': 'Casa',
			'stats.gojfCard': 'Carta Salida Gratis de la Cárcel',
			'stats.noProperties': '{player} no tiene propiedades.',
			'trade.includePropertyTitle': 'Marca esta casilla para incluir {place} en el trato.',
			'trade.includeCardTitle': 'Marca esta casilla para incluir la carta Salida Gratis de la Cárcel en el trato.',
			'trade.noProperties': '{player} no tiene propiedades que intercambiar.',
			'trade.selectPlayerTitle': 'Selecciona un jugador con quien intercambiar.',
			'manage.mortgageValue': 'Hipotecar (${amount})',
			'manage.mortgageTitle': 'Hipotecar {place} por ${amount}.',
			'manage.buyHouseValue': 'Comprar casa (${amount})',
			'manage.buyHotelValue': 'Comprar hotel (${amount})',
			'manage.sellHouseValue': 'Vender casa (${amount})',
			'manage.sellHotelValue': 'Vender hotel (${amount})',
			'manage.buyHouseTitle': 'Comprar una casa por ${amount}',
			'manage.buyHotelTitle': 'Comprar un hotel por ${amount}',
			'manage.sellHouseTitle': 'Vender una casa por ${amount}',
			'manage.sellHotelTitle': 'Vender un hotel por ${amount}',
			'manage.needOwnGroup': 'Para comprar una casa, debes ser dueño de todas las propiedades de este grupo de color.',
			'manage.needUnmortgage': 'Para comprar una casa, debes deshipotecar todas las propiedades de este grupo de color.',
			'manage.needOneEach': 'Para comprar otra casa, las demás propiedades del grupo de color deben tener una casa.',
			'manage.need4Each': 'Para comprar un hotel, las demás propiedades del grupo de color deben tener 4 casas.',
			'manage.needNEach': 'Para comprar una casa, las demás propiedades del grupo de color deben tener {n} casas.',
			'manage.sellNeedOne': 'Para vender una casa, las demás propiedades del grupo de color deben tener una casa.',
			'manage.sellNeedN': 'Para vender una casa, las demás propiedades del grupo de color deben tener {n} casas.',
			'manage.mortgageNeedUnimproved': 'Para hipotecar una propiedad, todas las propiedades de su grupo de color deben estar sin mejoras.',
			'popup.tradeNoProperties': 'Debes seleccionar al menos una propiedad para intercambiar.',
			'popup.tradeProposed': '{initiator} te propuso un trato, {recipient}. Puedes aceptarlo, rechazarlo o modificarlo.',
			'popup.tradeAccepted': '{recipient} aceptó tu oferta.',
			'popup.tradeDeclined': '{recipient} rechazó tu oferta.',
			'popup.tradeCounter': '{recipient} propuso una contraoferta.',
			'popup.bankruptcyUnmortgageNote': '{recipient}, puedes deshipotecar cualquiera de estas propiedades sin interés haciendo clic en ellas. Pulsa OK al terminar.',
			'popup.unmortgageProp': 'Deshipotecar {place} (${amount})',
			'popup.unmortgageTitle': 'Deshipotecar {place} por ${amount}.',

			'common.thebank': 'el banco',
			'cc.title': 'Caja de Comunidad:',
			'chance.title': 'Suerte:',
			'source.cc': 'Caja de Comunidad',
			'source.chance': 'Suerte',

			'cc.0': 'Sal de la cárcel gratis. Esta carta puede guardarse hasta usarla o venderse.',
			'cc.1': 'Has ganado el segundo premio en un concurso de belleza. Cobra $10.',
			'cc.2': 'Por la venta de acciones cobras $50.',
			'cc.3': 'Vence tu seguro de vida. Cobra $100.',
			'cc.4': 'Devolución del impuesto sobre la renta. Cobra $20.',
			'cc.5': 'Vence tu fondo de vacaciones. Cobra $100.',
			'cc.6': 'Recibes una herencia de $100.',
			'cc.7': 'Cobra $25 por una consultoría.',
			'cc.8': 'Paga $100 de gastos hospitalarios.',
			'cc.9': 'Error del banco a tu favor. Cobra $200.',
			'cc.10': 'Paga $50 de matrícula escolar.',
			'cc.11': 'Honorarios del médico. Paga $50.',
			'cc.12': 'Es tu cumpleaños. Cobra $10 de cada jugador.',
			'cc.13': 'Avanza a "SALIDA" (Cobra $200).',
			'cc.14': 'Te toca pagar reparaciones de calles. $40 por casa. $115 por hotel.',
			'cc.15': 'Ve a la cárcel. Ve directamente a la cárcel. No pases por "SALIDA". No cobres $200.',

			'chance.0': 'SAL DE LA CÁRCEL GRATIS. Esta carta puede guardarse hasta usarla o intercambiarse.',
			'chance.1': 'Haz reparaciones generales en todas tus propiedades. Por cada casa paga $25. Por cada hotel $100.',
			'chance.2': 'Multa por exceso de velocidad: $15.',
			'chance.3': 'Has sido elegido presidente del consejo. Paga $50 a cada jugador.',
			'chance.4': 'Retrocede tres casillas.',
			'chance.5': 'AVANZA AL SERVICIO MÁS CERCANO. SI NO TIENE DUEÑO, puedes comprarlo al banco. SI TIENE DUEÑO, tira los dados y paga al dueño diez veces el valor obtenido.',
			'chance.6': 'El banco te paga un dividendo de $50.',
			'chance.7': 'AVANZA AL FERROCARRIL MÁS CERCANO. Si NO TIENE DUEÑO, puedes comprarlo al banco. Si TIENE DUEÑO, paga al dueño el doble del alquiler al que tendría derecho.',
			'chance.8': 'Paga $15 de impuesto pobre.',
			'chance.9': 'Viaje al Ferrocarril Reading. Si pasas por "SALIDA" cobra $200.',
			'chance.10': 'AVANZA al Paseo del Mar.',
			'chance.11': 'AVANZA a la Avenida Illinois. Si pasas por "SALIDA" cobra $200.',
			'chance.12': 'Vence tu préstamo de construcción. Cobra $150.',
			'chance.13': 'AVANZA AL FERROCARRIL MÁS CERCANO. Si NO TIENE DUEÑO, puedes comprarlo al banco. Si TIENE DUEÑO, paga al dueño el doble del alquiler al que tendría derecho.',
			'chance.14': 'AVANZA a la Plaza St. Charles. Si pasas por "SALIDA" cobra $200.',
			'chance.15': 'Ve a la cárcel. Ve directamente a la cárcel. No pases por "SALIDA". No cobres $200.',

			// Help modal
			'help.openTitle': 'Ayuda y reglas (?)',
			'help.title': 'Cómo jugar',
			'help.shortcutsTitle': 'Atajos de teclado',
			'help.kbdSpace': 'Espacio',
			'help.kbdRollDesc': 'Tirar dados / Iniciar partida',
			'help.kbdEnterDesc': 'Terminar turno / confirmar acción principal',
			'help.kbdBDesc': 'Pestaña Comprar',
			'help.kbdMDesc': 'Pestaña Administrar',
			'help.kbdTDesc': 'Pestaña Intercambiar',
			'help.kbdSDesc': 'Ver estadísticas',
			'help.kbdHelpDesc': 'Abrir esta ayuda',
			'help.kbdEscDesc': 'Cerrar modal',
			'help.rulesTitle': 'Reglas rápidas',
			'help.ruleRoll': 'En tu turno, tira los dados. Tu ficha avanza casilla por casilla hasta el destino.',
			'help.ruleBuy': 'Si caes en una propiedad sin dueño, puedes comprarla al precio indicado.',
			'help.ruleRent': 'Si caes en una propiedad con dueño, pagas alquiler. Tener todo el grupo de color duplica el alquiler, y luego sube con casas (1→4) y un hotel.',
			'help.ruleBuild': 'Cuando tienes un grupo de color completo, puedes construir casas. Debes construir parejo en todo el grupo.',
			'help.ruleJail': 'Tres dobles seguidos, o caer en "Ve a la cárcel", te encierra. Paga $50 o saca dobles para salir.',
			'help.ruleGo': 'Al pasar por SALIDA cobras $200.',
			'help.ruleWin': 'Gana el último jugador que no quiebre.',
			'help.tipsTitle': 'Tips',
			'help.tipHover': 'Pasa el cursor sobre cualquier propiedad del tablero para ver su título con el alquiler actual y el dueño.',
			'help.tipMonopoly': 'Tener un grupo de color completo duplica el alquiler inmediatamente, aunque no tengas casas.',
			'help.tipCash': 'Mantén una reserva de efectivo — caer en el hotel de otro puede arruinarte de un solo golpe.',
			'help.tipMortgage': 'Hipotecar te devuelve la mitad del precio. Recuperar la hipoteca cuesta 10% de interés.',

			// Onboarding tour
			'tour.skip':   'Saltar',
			'tour.next':   'Siguiente',
			'tour.finish': 'Entendido',
			'tour.s1.title': 'Tirar los dados',
			'tour.s1.body':  'Esta es tu acción principal. Haz clic (o pulsa Espacio) para tirar y mover tu ficha.',
			'tour.s2.title': 'El tablero',
			'tour.s2.body':  'Pasa el cursor sobre cualquier propiedad para ver su título. Si caes en una, puedes comprarla.',
			'tour.s3.title': 'Dinero y jugadores',
			'tour.s3.body':  'Aquí está el efectivo de cada jugador. La fila del jugador activo se resalta.',
			'tour.s4.title': '¿Necesitas ayuda?',
			'tour.s4.body':  'Ábrelo cuando quieras para ver reglas completas y atajos de teclado. ¡A jugar!',

			// Consequence preview tooltip
			'preview.current': 'Ahora',
			'preview.after':   'Después',
			'preview.cantAfford': 'No te alcanza.',
			'preview.lowCash': 'Reserva de efectivo baja.',

			// Money bar
			'mb.propsTitle': 'Propiedades en tu poder',
			'mb.netWorthTitle': 'Patrimonio (efectivo + propiedades + edificios)',

			// Side panel sections
			'panel.playersLabel': 'Jugadores · Banco',
			'panel.actionsLabel': 'Tu turno · Acciones',
			'panel.upNext': 'Siguen:',
			'panel.aiThinking': '⏳ {player} está pensando…',
			'panel.aiRecapTitle': 'Resumen del turno',

			// Board edition selector
			'setup.editionLabel': 'Edición del tablero:',
			'setup.editionTitle': 'Elige el tablero. Cambiarlo recargará la página.',
			'setup.editionClassic': 'Clásica',
			'setup.editionNYC': 'Nueva York',

			// Setup presets
			'setup.presetsTitle': 'Elige un perfil de partida',
			'setup.presetQuick': 'Rápida',
			'setup.presetQuickSub': '$1000 · ágil',
			'setup.presetStandard': 'Clásica',
			'setup.presetStandardSub': '$1500 · estándar',
			'setup.presetLong': 'Larga',
			'setup.presetLongSub': '$2500 · maratón',

			// House rules
			'setup.houseRulesTitle': 'Reglas de la casa (opcionales)',
			'setup.ruleFP':        'Bote de Free Parking',
			'setup.ruleFPSub':     'Impuestos y multas se acumulan; quien cae en Free Parking se lleva el bote.',
			'setup.ruleSnake':     'Bono de ojos de serpiente',
			'setup.ruleSnakeSub':  'Sacar doble 1 paga $500.',
			'setup.ruleDoubleGo':  'GO doble',
			'setup.ruleDoubleGoSub': 'Caer exactamente en SALIDA paga $400 en vez de $200.',
			'setup.ruleNoAuc':     'Sin subastas',
			'setup.ruleNoAucSub':  'Las propiedades no compradas vuelven al banco.',
			'setup.ruleSpeed':     'Modo rápido',
			'setup.ruleSpeedSub':  'Todas las animaciones 2× más rápidas.',

			// House-rule alerts
			'alert.snakeEyes':     '🎲 ¡{player} sacó ojos de serpiente — bono $500!',
			'alert.doubleGo':     '💰 ¡{player} cayó justo en SALIDA — salario doble ($400)!',
			'alert.freeParkingWin': '🅿️ ¡{player} se llevó el bote de Free Parking — ${amount}!',
			'landed.noAuctionHint': 'Tip: si no compras, la propiedad vuelve al banco.',
			'ui.careerWins':       '🏆 {count} victorias totales',
			'ui.careerWins.one':   '🏆 1 victoria total',
			'ui.careerWins.other': '🏆 {count} victorias totales'
		}
	};

	function init() {
		var saved = null;
		try { saved = window.localStorage.getItem('monopoly:lang'); } catch (e) {}
		if (saved === 'en' || saved === 'es') {
			lang = saved;
			return;
		}
		var nav = (navigator.language || 'en').toLowerCase();
		lang = (nav.indexOf('es') === 0) ? 'es' : 'en';
	}

	function set(newLang) {
		if (newLang !== 'en' && newLang !== 'es') return;
		lang = newLang;
		try { window.localStorage.setItem('monopoly:lang', newLang); } catch (e) {}
		applyToDOM();
		document.documentElement.lang = newLang;
		document.body.setAttribute('lang', newLang);
		var btnEn = document.querySelector('.lang-btn-en');
		var btnEs = document.querySelector('.lang-btn-es');
		if (btnEn) { if (lang === 'en') btnEn.classList.add('active'); else btnEn.classList.remove('active'); }
		if (btnEs) { if (lang === 'es') btnEs.classList.add('active'); else btnEs.classList.remove('active'); }
	}

	function get() { return lang; }

	// HTML-escape user-controllable values before injection via innerHTML.
	// Centralized here because t()'s interpolated values are routinely inlined
	// into innerHTML by popup() and panel renderers.
	var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	function escapeHTML(s) {
		return String(s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
	}

	function t(key, vars) {
		var entry = (dict[lang] && dict[lang][key]);
		if (typeof entry !== 'string') {
			entry = (dict.en && dict.en[key]);
		}
		if (typeof entry !== 'string') {
			return key;
		}
		if (vars) {
			for (var k in vars) {
				if (vars.hasOwnProperty(k)) {
					entry = entry.split('{' + k + '}').join(escapeHTML(vars[k]));
				}
			}
		}
		return entry;
	}

	// Plural-aware lookup. Picks <key>.zero / <key>.one / <key>.other based on
	// `count`, falling back to <key> if no suffixed variant exists. Mostly two
	// forms (one/other) — Spanish and English don't need more here.
	function tn(key, count, vars) {
		vars = vars || {};
		if (vars.count === undefined) vars.count = count;
		var suffix = count === 0 ? '.zero' : count === 1 ? '.one' : '.other';
		var suffixed = key + suffix;
		var entry = (dict[lang] && dict[lang][suffixed]) || (dict.en && dict.en[suffixed]);
		return (typeof entry === 'string') ? t(suffixed, vars) : t(key, vars);
	}

	// Read interpolation variables from an optional `data-i18n-vars` attribute
	// (JSON object) on the same element. Malformed JSON falls back to no vars.
	function readVars(el) {
		var raw = el.getAttribute('data-i18n-vars');
		if (!raw) return null;
		try { return JSON.parse(raw); } catch (e) { return null; }
	}

	function applyToDOM() {
		var i, el, key, vars;
		var nodes = document.querySelectorAll('[data-i18n]');
		for (i = 0; i < nodes.length; i++) {
			el = nodes[i];
			key = el.getAttribute('data-i18n');
			vars = readVars(el);
			el.textContent = t(key, vars);
		}
		nodes = document.querySelectorAll('[data-i18n-title]');
		for (i = 0; i < nodes.length; i++) {
			el = nodes[i];
			key = el.getAttribute('data-i18n-title');
			vars = readVars(el);
			el.title = t(key, vars);
		}
		nodes = document.querySelectorAll('[data-i18n-value]');
		for (i = 0; i < nodes.length; i++) {
			el = nodes[i];
			key = el.getAttribute('data-i18n-value');
			vars = readVars(el);
			el.value = t(key, vars);
		}
		nodes = document.querySelectorAll('[data-i18n-aria]');
		for (i = 0; i < nodes.length; i++) {
			el = nodes[i];
			key = el.getAttribute('data-i18n-aria');
			vars = readVars(el);
			el.setAttribute('aria-label', t(key, vars));
		}
		nodes = document.querySelectorAll('[data-i18n-placeholder]');
		for (i = 0; i < nodes.length; i++) {
			el = nodes[i];
			key = el.getAttribute('data-i18n-placeholder');
			vars = readVars(el);
			el.setAttribute('placeholder', t(key, vars));
		}
	}

	return { init: init, set: set, get: get, t: t, tn: tn, applyToDOM: applyToDOM, escape: escapeHTML };
})();

function t(key, vars) { return I18N.t(key, vars); }
function tn(key, count, vars) { return I18N.tn(key, count, vars); }
