var uuid = require('uuid/v4');

module.exports = function Pmessage(props) {

    const scope = this;
    const state = scope.state = Object.assign({
        source: window.opener || window.parent,
        secure: false,
        timeout: 1000,
        timeouts: {},
        origin: '*'
    }, props);

    scope.listeners = {};

    window.addEventListener('message', e => scope.handleMessage(e));

    scope.handleMessage = function(e) {
        var allowed = (state.secure && e.origin === window.location.origin)
            || (!state.secure && (
                state.origin === e.origin || state.origin === '*'
            ));
        if (!allowed) {
            throw new Error('origin not allowed');
        }
        console.log(window.opener, window.parent);
        Object.keys(scope.listeners).forEach(key => {
            if (e.data && e.data.type === key && e.data.uid && scope.listeners[key].length) {
                scope.listeners[key].forEach(listener => {
                    scope.emit(e.data.uid, listener(e.data.payload, e), e.data.uid, e.source);
                });
            }
        });
    };

    scope.on = function(event, fn) {
        if (typeof event !== 'string') {
            throw new Error('invalid event name');
        }
        if (typeof fn !== 'function') {
            throw new Error('invalid handler function');
        }
        if (!scope.listeners[event]) {
            scope.listeners[event] = [];
        }
        scope.listeners[event].push(fn);
    };

    scope.once = function(event, fn) {
        var wrapFn = (...args) => {
            const index = scope.listeners[event].indexOf(fn);
            if (index > -1) {
                delete scope.listeners[event][index];
            }
            fn.apply(scope, args);
        };
        scope.on(event, wrapFn);
    };

    scope.off = function(event) {
        delete scope.listeners[event];
    };

    scope.send = function(type, payload, source) {
        return new Promise((respond, reject) => {
            var uid = uuid();
            scope.once(uid, payload => {
                window.clearTimeout(state.timeouts[uid]);
                respond(payload);
            });
            state.timeouts[uid] = window.setTimeout(() => {
                reject('pmessage timeout: ' + type);
            }, state.timeout);
            scope.emit(type, payload, uid, source || state.source);
        });
    };

    scope.emit = function(type, payload, uid, source) {
        if (!source) {
            throw new Error('invalid source');
        }
        source.postMessage(
            {type, payload, uid},
            state.secure
            ? window.location.origin
            : state.origin
        );
    };

    return scope;

};

