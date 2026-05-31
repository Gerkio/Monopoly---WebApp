// AI persona swap: spin up a game per AI level (Easy/Normal/Hard/Adaptive),
// confirm each constructor instantiated and its instance type matches.
var harness = require('../harness.js');

var LEVELS = [
    { code: '1', name: 'Easy',     constructor: 'AIEasy' },
    { code: '2', name: 'Normal',   constructor: 'AINormal' },
    { code: '3', name: 'Hard',     constructor: 'AIHard' },
    { code: '4', name: 'Adaptive', constructor: 'AIAdaptive' }
];

(async () => {
    var rep = harness.reporter('05-ai-persona-swap');
    var page;
    try {
        for (var i = 0; i < LEVELS.length; i++) {
            var L = LEVELS[i];
            page = await harness.launch();
            await harness.startGame(page.cdp, { aiLevel: L.code });

            // Player 2 should have an AI instance of the expected constructor.
            var hasAI = await page.cdp.eval(
                "player[2] && player[2].AI && (player[2].AI.constructor.name === '" + L.constructor + "' || " +
                " player[2].AI instanceof " + L.constructor + ")"
            );
            rep.check(L.name + ' instance is ' + L.constructor, hasAI);

            // Contract: every AI exposes buyProperty/acceptTrade/beforeTurn/onLand/postBail/payDebt/bid.
            var contractOk = await page.cdp.eval(
                "(function(){var a = player[2].AI;" +
                " var keys = ['buyProperty','acceptTrade','beforeTurn','onLand','postBail','payDebt','bid'];" +
                " for (var k=0;k<keys.length;k++) if (typeof a[keys[k]] !== 'function') return false;" +
                " return true;})()"
            );
            rep.check(L.name + ' implements the full AI contract', contractOk);

            // Adaptive-specific: it should have its 3 sub-instances.
            if (L.code === '4') {
                var hasSubs = await page.cdp.eval(
                    "player[2].AI._easy && player[2].AI._normal && player[2].AI._hard"
                );
                rep.check('Adaptive carries _easy/_normal/_hard sub-instances', !!hasSubs);
                var startLevel = await page.cdp.eval("player[2].AI._level");
                rep.check('Adaptive starts at "normal"', startLevel === 'normal');
            }

            page.close();
            page = null;
            // Pause between sessions so the next browser launch doesn't fight
            // for the same debug port.
            await harness.launch.toString && await new Promise(function (r) { setTimeout(r, 400); });
        }
    } catch (e) {
        rep.check('test ran without exception', false, e.message);
    } finally {
        if (page) page.close();
        setTimeout(function () { rep.done(); process.exit(process.exitCode || 0); }, 600);
    }
})();
