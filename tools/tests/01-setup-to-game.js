// Smoke: load index.html, configure 2 players, start game, verify the
// setup screen hides and the control panel shows.
var harness = require('../harness.js');

(async () => {
    var rep = harness.reporter('01-setup-to-game');
    var page;
    try {
        page = await harness.launch();
        // Pre-start checks
        var setupVisibleBefore = await page.cdp.eval(
            "document.getElementById('setup').style.display !== 'none'"
        );
        rep.check('setup screen visible before start', setupVisibleBefore);

        await harness.startGame(page.cdp, { aiLevel: '1' });

        // Post-start checks
        var setupHidden = await page.cdp.eval(
            "document.getElementById('setup').style.display === 'none'"
        );
        rep.check('setup screen hides after start', setupHidden);

        var controlVisible = await page.cdp.eval(
            "document.getElementById('control').style.display !== 'none'"
        );
        rep.check('control panel visible after start', controlVisible);

        var p1OnGo = await page.cdp.eval("player[1].position === 0");
        rep.check('player 1 starts on cell 0 (GO)', p1OnGo);

        var twoPlayers = await page.cdp.eval("typeof pcount !== 'undefined' && pcount === 2");
        rep.check('pcount is 2', twoPlayers);

        var liveRegions = await page.cdp.eval(
            "!!document.getElementById('turn-announcer') && !!document.getElementById('game-announcer')"
        );
        rep.check('a11y live regions exist (Item 1)', liveRegions);

        var gameStateExists = await page.cdp.eval(
            "typeof window.GameState === 'object' && typeof window.GameConfig === 'object'"
        );
        rep.check('GameState/GameConfig namespaces exist (Item 3)', gameStateExists);

    } catch (e) {
        rep.check('test ran without exception', false, e.message);
    } finally {
        if (page) page.close();
        setTimeout(function () { rep.done(); process.exit(process.exitCode || 0); }, 600);
    }
})();
