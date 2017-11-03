var uuid = require('uuid/v4');

module.exports = function Pmessage(props) {

    const scope = this;
    const state = scope.state = Object.assign({
        target: window.parent,
        secure: false,
        timeout: 3000,
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
        Object.keys(scope.listeners).forEach(key => {
            if (e.data && e.data.type === key && e.data.uid && scope.listeners[key].length) {
                scope.listeners[key].forEach(listener => {
                    scope.emit(e.data.uid, listener(e.data.payload), e.data.uid, e.data.id);
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
        scope.listeners[event].push((...args) => {
            return fn.apply(scope, [...args]);
        });
    };

    scope.once = function(event, fn) {
        var wrapFn = () => {
            fn(event);
            scope.off(event);
        };
        scope.on(event, wrapFn);
    };

    scope.off = function(event) {
        delete scope.listeners[event];
    };

    scope.send = function(type, payload) {
        return new Promise((respond, reject) => {
            var uid = uuid();
            scope.once(uid, payload => {
                window.clearTimeout(state.timeouts[uid]);
                respond(payload);
            });
            state.timeouts[uid] = window.setTimeout(() => {
                reject('PM Timeout Error: type: ' + type + ', uid: ' + uid);
            }, state.timeout);
            scope.emit(type, payload, uid);
        });
    };

    scope.emit = function(type, payload, uid) {
        if (!state.target) {
            throw new Error('target window not set');
        }
        state.target.postMessage(
            {type, payload, uid, id: state.id},
            state.secure
            ? window.location.origin
            : state.origin
        );
    };

    return scope;

};

