var uuid = require('uuid/v4');

module.exports = function Pmessage(props) {

    var scope = this;

    scope.state = Object.assign({
        target: window.parent,
        secure: false,
        timeout: 1000,
        timeouts: {},
        origin: '*'
    }, props);

    scope.listeners = {};

    window.addEventListener('message', e => scope.handleMessage(e));

    scope.handleMessage = function(e) {
        var state = scope.state;
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
                    var payload = listener(e.data.payload);
                    scope.emit(e.data.uid, payload, e.data.uid);
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
            scope.off(event, wrapFn);
            fn(event);
        };
        scope.on(event, wrapFn);
    };

    scope.off = function(event, fn) {
        var listeners = scope.listeners[event];
        if (listeners) {
            listeners.forEach(listener => {
                console.log(listener.toString());
                console.log(fn.toString());
                console.log(listener.toString() === fn.toString());
            });
            //var index = listeners.indexOf(fn);
            //console.log(111, index);
            //if (index > -1) {
                //listeners.splice(index, 1);
                //if (!listeners.length) {
                    //delete scope.listeners[event];
                //}
            //}
        }
    };

    scope.send = function(type, payload) {
        return new Promise((respond, reject) => {
            var uid = uuid();
            scope.on(uid, payload => {
                window.clearTimeout(scope.state.timeouts[uid]);
                respond(payload);
            });
            scope.state.timeouts[uid] = window.setTimeout(() => {
                reject('PM Timeout Error: type: ' + type + ', uid: ' + uid);
            }, scope.state.timeout);
            scope.emit(type, payload, uid);
        });
    };

    scope.emit = function(type, payload, uid) {
        if (!scope.state.target) {
            throw new Error('target window not set');
        }
        scope.state.target.postMessage(
            {type, payload, uid},
            scope.state.secure
            ? window.location.origin
            : scope.state.origin
        );
    };

    return scope;

};

