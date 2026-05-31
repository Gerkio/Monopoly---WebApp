// Bankruptcy: inject a huge debt against an AI player, trigger bankruptcy
// directly, verify the engine handles the elimination cleanly.
var harness = require('../harness.js');

(async () => {
    var rep = harness.reporter('04-bankruptcy');
    var page;
    try {
        page = await harness.launch();
        // 2 players: P1 human, P2 AI Easy. We'll bankrupt P2.
        await harness.startGame(page.cdp, { aiLevel: '1' });

        // Drain P2's cash so the bankruptcy path is reachable, and force
        // turn=2 so bankruptcy() acts on the correct player slot.
        await page.cdp.eval(
            "player[2].money = -500;" +
            "player[2].creditor = 0;" +   // owe the bank, not another player
            "var prevTurn = turn;" +
            "turn = 2;" +
            "game.bankruptcy();" +
            "window.__p2BankruptDone = true;"
        );
        await page.sleep(400);

        var bankruptcyDone = await page.cdp.eval("window.__p2BankruptDone === true");
        rep.check('bankruptcy() ran without throwing', bankruptcyDone);

        var p2Money = await page.cdp.eval("player[2].money");
        // After bankruptcy, money is irrelevant — we just care the engine didn't
        // crash and the elimination flag was set OR ownership cleared.
        var anyOwnedByP2 = await page.cdp.eval(
            "(function(){var n=0;for(var i=0;i<40;i++)if(square[i].owner===2)n++;return n;})()"
        );
        rep.check('no properties still owned by bankrupt player', anyOwnedByP2 === 0);

        // window.sq should NOT have leaked to global (Item 3 cleanup).
        var sqGlobal = await page.cdp.eval("typeof window.sq");
        rep.check('no implicit `sq` global after bankruptcy (Item 3)', sqGlobal === 'undefined');

    } catch (e) {
        rep.check('test ran without exception', false, e.message);
    } finally {
        if (page) page.close();
        setTimeout(function () { rep.done(); process.exit(process.exitCode || 0); }, 600);
    }
})();
