// Buy & auction flow:
//   1. Force the human (P1) onto a buyable cell.
//   2. Confirm the #landed prompt opens with a buy button and pendingBuyDecision
//      blocks the next roll (Item 1 + roll-gate).
//   3. Click Buy. Confirm ownership transfers and the flag releases.
//   4. Force-trigger an auction queue + drain it; confirm game.auction works.
var harness = require('../harness.js');

(async () => {
    var rep = harness.reporter('03-buy-auction');
    var page;
    try {
        page = await harness.launch();
        await harness.startGame(page.cdp, { aiLevel: '1' });

        // Stub dice → 2+1 = 3 (land on Baltic Av in classic edition: $60).
        await page.cdp.eval(
            "game.rollDice = function(){ game._d1=2; game._d2=1; };" +
            "game.getDie = function(d){ return d===1 ? 2 : 1; };"
        );

        // First roll → land on cell 3 (Baltic).
        await page.cdp.eval(
            "window.GameState.skipNextUpdateDice = true;" +
            "document.getElementById('nextbutton').click();"
        );
        await page.cdp.waitFor("!window.GameState.walking", 8000);
        await page.sleep(400);

        // The buy prompt should be up and the roll gate engaged.
        var promptOpen = await page.cdp.eval(
            "document.getElementById('landed') && " +
            "document.getElementById('landed').innerHTML.indexOf('buybtn-landed') >= 0"
        );
        rep.check('buy prompt visible on Baltic', promptOpen);
        var gateEngaged = await page.cdp.eval("!!window.GameState.pendingBuyDecision");
        rep.check('roll gate engaged for human buy decision', gateEngaged);

        // Click Buy.
        await page.cdp.eval(
            "var b=document.getElementById('buybtn-landed'); if(b) b.click();"
        );
        await page.sleep(400);

        var p1OwnsBaltic = await page.cdp.eval("square[3].owner === 1");
        rep.check('player 1 owns Baltic after buy', p1OwnsBaltic);
        var gateReleased = await page.cdp.eval("!window.GameState.pendingBuyDecision");
        rep.check('roll gate released after buy', gateReleased);

        // Auction sanity: enqueue a property and trigger.
        await page.cdp.eval(
            "game.addPropertyToAuctionQueue(1);" + // Mediterranean
            "var ret = game.auction();" +
            "window.__auctionRet = ret;"
        );
        await page.sleep(400);
        var auctionFired = await page.cdp.eval("window.__auctionRet === true");
        rep.check('game.auction() returns true when queue has entries', auctionFired);

        // Close the auction UI cleanly so the run can exit.
        await page.cdp.eval(
            "var ex=document.querySelector('.auction-btn-exit'); if(ex) ex.click();" +
            "var pw=document.getElementById('popupwrap');" +
            "if (pw) pw.style.display='none';"
        );

    } catch (e) {
        rep.check('test ran without exception', false, e.message);
    } finally {
        if (page) page.close();
        setTimeout(function () { rep.done(); process.exit(process.exitCode || 0); }, 600);
    }
})();
