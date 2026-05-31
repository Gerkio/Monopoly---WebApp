// Browser harness: spawn Edge/Chrome headless, wait for CDP, return a connected page.
// Test scripts (tools/tests/*.js) import this to get one-call setup.

var path = require('path');
var fs   = require('fs');
var os   = require('os');
var spawn = require('child_process').spawn;
var cdp  = require('./cdp.js');

// Try a list of well-known Chrome/Edge install paths and return the first one
// that exists. Order: Edge first (default browser on Windows 11), Chrome second.
function findBrowser() {
    var candidates = [
        process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env['ProgramFiles'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env['ProgramFiles'] + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['ProgramFiles(x86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
        (process.env['LOCALAPPDATA'] || '') + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] && fs.existsSync(candidates[i])) return candidates[i];
    }
    throw new Error('No Chromium-based browser found. Install Edge or Chrome.');
}

// Launch the browser headless against the local file:// path of index.html.
// Returns { browser, cdp, target } when ready.
async function launch(opts) {
    opts = opts || {};
    var browser = findBrowser();
    var port = opts.port || 9333;
    var profileDir = path.join(os.tmpdir(), 'monopoly-cdp-' + Date.now());
    var repoRoot = path.resolve(__dirname, '..');
    var indexHtml = 'file:///' + repoRoot.replace(/\\/g, '/') + '/index.html';

    var args = [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1920,1080',
        '--user-data-dir=' + profileDir,
        '--remote-debugging-port=' + port,
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required',
        indexHtml
    ];
    var proc = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stderr.on('data', function () { /* swallow Edge's noisy startup logs */ });

    // Poll until /json answers, then pick the page target.
    var targets = await cdp.waitDebug(port, 15000);
    var page = targets.find(function (t) { return t.type === 'page'; });
    if (!page) throw new Error('No page target found via CDP');
    var client = new cdp.CDP(page.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Console.enable');
    // Generous initial wait so monopoly.js boots, i18n applies, etc.
    await cdp.sleep(1800);

    return {
        cdp: client,
        sleep: cdp.sleep,
        close: function () {
            try { client.close(); } catch (e) {}
            try { proc.kill(); }    catch (e) {}
        }
    };
}

// Configure standard test fixture: 2 players (P1 human, P2 specified AI level),
// click Start, skip tour. Returns when game is interactive.
async function startGame(client, opts) {
    opts = opts || {};
    var aiLevel = opts.aiLevel || '2'; // Normal by default
    await client.eval("try{window.localStorage.setItem('monopoly:tourSeen','1')}catch(e){}");
    await client.eval("try{Sound.setMuted(true);}catch(e){}");
    await client.eval("document.getElementById('playernumber').value='2'; document.getElementById('playernumber').dispatchEvent(new Event('change'));");
    await cdp.sleep(300);
    await client.eval("document.getElementById('player2ai').value='" + aiLevel + "'; document.getElementById('player2ai').dispatchEvent(new Event('change'));");
    await cdp.sleep(300);
    await client.eval("document.getElementById('start-game-btn').click();");
    await cdp.sleep(2500);
    await client.eval("var sk=document.getElementById('tour-skip'); if(sk) sk.click();");
    await cdp.sleep(800);
}

// Tiny PASS/FAIL bookkeeping for individual test scripts.
function reporter(name) {
    var failures = [];
    return {
        check: function (label, cond, detail) {
            if (cond) console.log('  OK   ' + label);
            else { failures.push({ label: label, detail: detail }); console.log('  FAIL ' + label + (detail ? ' :: ' + detail : '')); }
        },
        done: function () {
            if (failures.length === 0) {
                console.log('PASS ' + name);
                process.exitCode = 0;
            } else {
                console.log('FAIL ' + name + ' (' + failures.length + ' failure' + (failures.length === 1 ? '' : 's') + ')');
                process.exitCode = 1;
            }
        }
    };
}

module.exports = { launch: launch, startGame: startGame, reporter: reporter };
