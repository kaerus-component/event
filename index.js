require('./shims/weakmap');

var Emitter = require('emitter'),
    elements = new WeakMap(),
    debug;

// Event /////////////////////////////////////////////////////////////////////////////
var Event = new Emitter({
    normalize: function(event) {
        // normalize 'inspired' from Secrets of the Javascript Ninja by John Resig
        // Reference http://www.quirksmode.org/dom/events/
        function returnTrue() { return true; }
        function returnFalse() { return false; }

        if (!event || !event.stopPropagation) {
            // Clone the old object so that we can modify the values
            event = clone(event || window.event);

            // The event occurred on this element
            if (!event.target) {
                event.target = event.srcElement || document;
            }
            // Handle which other element the event is related to
            event.relatedTarget = event.fromElement === event.target ? event.toElement : event.fromElement;
            // Stop the default browser action
            event.preventDefault = function () {
                event.returnValue = false;
                event.isDefaultPrevented = returnTrue;
            };
            event.isDefaultPrevented = returnFalse;
            // Stop the event from bubbling
            event.stopPropagation = function () {
                event.cancelBubble = true;
                event.isPropagationStopped = returnTrue;
            };
            event.isPropagationStopped = returnFalse;
            // Stop the event from bubbling and executing other handlers
            event.stopImmediatePropagation = function () {
                this.isImmediatePropagationStopped = returnTrue;
                this.stopPropagation();
            };
            event.isImmediatePropagationStopped = returnFalse;
            // Handle mouse position
            if (event.clientX !== null) {
                var doc = document.documentElement,
                    body = document.body;

                event.pageX = event.clientX + (doc &&
					       doc.scrollLeft || body &&
					       body.scrollLeft || 0) - (doc &&
									doc.clientLeft || body &&
									body.clientLeft || 0);

                event.pageY = event.clientY + (doc &&
					       doc.scrollTop || body &&
					       body.scrollTop || 0) - (doc &&
								       doc.clientTop || body &&
								       body.clientTop || 0);
            }
            // Handle key presses
            event.which = event.charCode || event.keyCode;
            // Fix button for mouse clicks: // 0 == left; 1 == middle; 2 == right
            if (event.button !== null) {
                event.button = (event.button & 1 ? 0 : (event.button & 4 ? 1 : (event.button & 2 ? 2 : 0)));
            }
            // mouse scroll
            event.wheelDelta = event.wheelDelta || -event.Detail * 40;
        }

        return event;
    },
    bind: function(el,ev,fn,cap){
        return addEventListener(el,ev,fn,cap);
    },
    unbind: function(el,ev,fn){
        return removeEventListener(el,ev,fn);
    },
    add: function(el,ev,fn,cap){
        ev = ev.toLowerCase().split(' ');

        for(var i = 0, l = ev.length; i < l; i++) attach(el,ev[i],fn,cap);
    },
    remove: function(el,ev,fn){
        ev = ev.toLowerCase().split(' ');

        for(var i = 0, l = ev.length; i < l; i++) detach(el,ev[i],fn);
    },
    delegate: function(el,ev,fn){
        var p, element = mapElement(el);

        if(!element){
            if(debug) console.debug("[delegate]: invalid element");
            return;
        }

        ev = ev.toLowerCase().split(' ');

        for(var i = 0, l = ev.length; i < l; i++){
            attach(document,ev[i],delegate,true);

            p = element.path+'<'+ev[i]+'>';

            if(debug) console.debug("[delegate]:", p);

            Event.on(p,fn);
        }
    },
    undelegate: function(el,ev,fn){
        var p, element = elements.get(el);

        if(!element){
            if(debug) console.debug("[undelegate] ignoring:", elementXPath(el));
            return;
        }

        ev = ev.toLowerCase().split(' ');

        for(var i = 0, l = ev.length; i < l; i++){
            p = element.path + '<'+ev[i]+'>';
            Event.off(p,fn);

            if(!Event.hasListeners(p))
                detach(document,ev[i],delegate);
        }

    },
    path: function(el){
        var element = elements.get(el);
        return element ? element.path : undefined;
    },
    debug: function(on){
        debug = !!on;
    }
});

function addEventListener(el,ev,fn,cap){
    "use strict";

    if(el.addEventListener){
        el.addEventListener(ev, fn, !!cap);
    } else if (el.attachEvent){
        el.attachEvent('on' + ev, fn);
    }  else el['on' + ev] = fn;

    return el;
}

function removeEventListener(el,ev,fn){
    "use strict";

    if(el.removeEventListener){
        el.removeEventListener(ev, fn, false);
    } else if (el.detachEvent){
        el.detachEvent('on' + ev, fn);
    } else el['on' + ev] = null;

    return el;
}

function mapElement(el){
    "use strict";

    var p, element = elements.get(el);

    if(!element){
        p = elementXPath(el);

        if(p === undefined || p === null)
            throw "[mapElement]: undefined path";

        element = { path: p, event: {} };

        elements.set(el,element);

        if(debug) console.debug("[mapElement]:", p);
    }

    return element;
}

function attach(el,ev,fn,cap){
    "use strict";

    var p, element = elements.get(el);

    if(!element) element = mapElement(el);

    p = element.path + '<'+ev+'>';

    if(!element.event[ev]){
        addEventListener(el,ev,dispatch,cap);
        element.event[ev] = Object.create(null);
    }

    if(typeof fn === 'object'){
        if(debug) console.debug("[augment]:", p, fn);

        extend(element.event[ev],fn);

        fn = fn.listener;
    }

    if(typeof fn === 'function') {
        if(debug) console.debug("[attach]:", p);

        Event.on(p,fn);
    }
}

function dispatch(event){

    event = Event.normalize(event);

    var p, ev = event.type, element = elements.get(this);

    if(!element) {
        if(debug) console.debug("[dispatch] ignoring: %s<%s>", elementXPath(this), ev);
        return;
    }

    p = element.path + '<'+ev+'>';

    if(debug) console.debug("[dispatch]:", p);

    if(element.event && element.event[ev]){
        extend(event,element.event[ev]);
    }

    Event.emit(this,p,event);
}


function detach(el,ev,fn){
    "use strict";

    var p, element = elements.get(el);

    if(!element){
        if(debug) console.debug("[detach] ignoring: %s<%s>", elementXPath(el), ev);
        return;
    }

    p = element.path + '<'+ev+'>';

    Event.off(p,fn);

    if(debug) console.debug("[detach](%s): %s", Event.listeners(p).length, p);
}

function delegate(event){
    "use strict";

    var p, element = elements.get(event.target);

    if(!element) {
        if(debug) console.debug("[delegate] ignoring: %s<%s>", elementXPath(event.target),event.type);
        return;
    }

    p = element.path + '<'+event.type+'>';

    if(debug) console.debug("[delegate]:", p);

    Event.emit(event.target,p,event);
}

function extend(e,o) {
    "use strict";

    for(var k in o) if(!e[k]) e[k] = o[k];

    return e;
}

function clone(ev,o) {
    "use strict";

    o = o ? o : Object.create(null);

    for (var p in ev) o[p] = ev[p];

    return o;
}


function elementXPath(el){
    "use strict";

    var i, n, path = [], tag, index;

    if(el === window) return '';
    if(el === document) return '/';

    for(;el && el.nodeType == 1;el = el.parentNode){
        i = 0;

        for(n = el.previousSibling; n; n = n.previousSibling){
            if (n.nodeType == Node.DOCUMENT_TYPE_NODE) continue;
            if (n.nodeName == el.nodeName) i=i+1;
        }

        tag = el.nodeName.toLowerCase();
        index = (i ? '[' + i + ']' : '');
        path.splice(0, 0, tag + index);
    }

    return path.length ? '/' + path.join('/') : null;
}

module.exports = Object.freeze ? Object.freeze(Event) : Event;
