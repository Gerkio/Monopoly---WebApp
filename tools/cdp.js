// Minimal Chrome DevTools Protocol client over WebSocket.
// No npm dependencies — uses Node's built-in WebSocket (>= v22 / v21 with flag).
// ES5-style on purpose to match the project's stylistic norm.

var http = require('http');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Poll the browser's debug endpoint until it answers.
function waitDebug(port, timeoutMs) {
    var start = Date.now();
    return new Promise(function (resolve, reject) {
        function tick() {
            http.get('http://127.0.0.1:' + port + '/json', function (r) {
                var data = '';
                r.on('data', function (c) { data += c; });
                r.on('end', function () {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { retryOrFail(); }
                });
            }).on('error', retryOrFail);
        }
        function retryOrFail() {
            if (Date.now() - start > (timeoutMs || 12000)) reject(new Error('CDP endpoint not reachable on port ' + port));
            else setTimeout(tick, 200);
        }
        tick();
    });
}

function CDP(wsUrl) {
    var self = this;
    self.id = 0;
    self.pending = new Map();
    self.listeners = new Map();
    self.ws = new WebSocket(wsUrl);
    self.ready = new Promise(function (res, rej) {
        self.ws.addEventListener('open',  function () { res(); });
        self.ws.addEventListener('error', rej);
    });
    self.ws.addEventListener('message', function (e) {
        var m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.id != null && self.pending.has(m.id)) {
            var cb = self.pending.get(m.id);
            self.pending.delete(m.id);
            if (m.error) cb.reject(new Error(m.error.message));
            else cb.resolve(m.result);
            return;
        }
        if (m.method && self.listeners.has(m.method)) {
            self.listeners.get(m.method).forEach(function (fn) {
                try { fn(m.params || {}); } catch (e) { /* listener errors are silent */ }
            });
        }
    });
}
CDP.prototype.send = function (method, params) {
    var self = this;
    params = params || {};
    return new Promise(function (res, rej) {
        var id = ++self.id;
        self.pending.set(id, { resolve: res, reject: rej });
        self.ws.send(JSON.stringify({ id: id, method: method, params: params }));
    });
};
CDP.prototype.on = function (method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
};
CDP.prototype.eval = async function (expr) {
    var r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
        var msg = r.exceptionDetails.text;
        if (r.exceptionDetails.exception && r.exceptionDetails.exception.description) {
            msg += ' | ' + r.exceptionDetails.exception.description;
        }
        throw new Error(msg);
    }
    return r.result && r.result.value;
};
CDP.prototype.waitFor = async function (expr, timeoutMs, pollMs) {
    timeoutMs = timeoutMs || 8000;
    pollMs = pollMs || 100;
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            var v = await this.eval(expr);
            if (v) return v;
        } catch (e) { /* expression threw, keep polling */ }
        await sleep(pollMs);
    }
    throw new Error('waitFor timeout: ' + expr);
};
CDP.prototype.close = function () { try { this.ws.close(); } catch (e) {} };

module.exports = { CDP: CDP, waitDebug: waitDebug, sleep: sleep };
