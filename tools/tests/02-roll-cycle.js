// Roll cycle: stub the dice to a deterministic non-double, click Roll, wait
// for the walk to complete, verify p.position equals (start + dice sum) % 40
// and the visual cell matches the logical position.
var harness = require('../harness.js');

(async () => {
    var rep = harness.reporter('02-roll-cycle');
    var page;
    try {
        page = await harness.launch();
        await harness.startGame(page.cdp, { aiLevel: '1' });

        // Stub dice to 2 + 4 (sum 6, never a double). Also stub Math.random
        // so any AI Easy "random buy" decisions are reproducible.
        await page.cdp.eval(
            "game.rollDice = function(){ game._d1=2; game._d2=4; };" +
            "game.getDie = function(d){ return d===1 ? 2 : 4; };" +
            "var __seed = 0.5;" +
            "Math.random = function(){ __seed = (__seed * 9301 + 49297) % 233280 / 233280; return __seed; };"
        );

        var startPos = await page.cdp.eval("player[1].position");
        rep.check('player 1 at GO before roll', startPos === 0);

        // Trigger one roll.
        await page.cdp.eval(
            "window.GameState.skipNextUpdateDice = true;" +
            "document.getElementById('nextbutton').click();"
        );
        // Wait for the walk to complete.
        await page.cdp.waitFor("!window.GameState.walking", 8000);
        // Drain any popup that landing might have raised (Buy/Auction/Tax/etc).
        await page.cdp.eval(
            "(function(){var bb=document.getElementById('buybtn-landed');" +
            " if(bb && bb.offsetParent !== null) bb.click();" +
            " var pw=document.getElementById('popupwrap');" +
            " if(pw && pw.style.display && pw.style.display!=='none'){" +
            "   var btns=['popupyes','popupok','popupclose','popupno'];" +
            "   for(var i=0;i<btns.length;i++){var b=document.getElementById(btns[i]);" +
            "     if(b && b.offsetParent !== null){b.click(); break;}}" +
            " }})();"
        );
        await page.sleep(500);

        var newPos = await page.cdp.eval("player[1].position");
        rep.check('player 1 moved exactly 6 cells', newPos === 6);

        var tokenCell = await page.cdp.eval(
            "(function(){var tok = window.__tokens && window.__tokens[1];" +
            " if (!tok || !tok.lastCellKey) return -1;" +
            " return parseInt(String(tok.lastCellKey).replace('cell',''), 10);})()"
        );
        rep.check('visual cell matches logical position', tokenCell === newPos);

        var walkingFlag = await page.cdp.eval("!!window.GameState.walking");
        rep.check('walking flag cleared after walk', !walkingFlag);

    } catch (e) {
        rep.check('test ran without exception', false, e.message);
    } finally {
        if (page) page.close();
        setTimeout(function () { rep.done(); process.exit(process.exitCode || 0); }, 600);
    }
})();
