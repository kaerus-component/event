var Emitter = require('emitter');

var debug;

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
        var path = xpath(el);

        ev = ev.toLowerCase().split(' ');

        for(var i = 0, l = ev.length; i < l; i++){ 
            attach(document,ev[i],delegate,true);
            Event.on(path + '<'+ev[i]+'>',fn);
        }
    },
    undelegate: function(el,ev,fn){
        var p, path = xpath(el);
        
        ev = ev.toLowerCase().split(' ');

        for(var i = 0, l = ev.length; i < l; i++){ 
            p = path + '<'+ev[i]+'>';
            Event.off(p,fn);

            if(!Event.hasListeners(p))
                detach(document,ev[i],delegate);
        }

    },
    path: function(el){
        return xpath(el);
    },
    debug: function(on){
        debug = !!on;
    }
});

function addEventListener(el,ev,fn,cap){
    "use strict"

    if(el.addEventListener){
        el.addEventListener(ev, fn, !!cap);
    } else if (el.attachEvent){
        el.attachEvent('on' + ev, fn);
    }  else el['on' + ev] = fn;

    return el;
}

function removeEventListener(el,ev,fn){
    "use strict"

    if(el.removeEventListener){
        el.removeEventListener(ev, fn, false);
    } else if (el.detachEvent){
        el.detachEvent('on' + ev, fn);
    } else el['on' + ev] = null;

    return el;
}

var events = { elements:[], paths:[], event: Object.create(null) };

function xpath(el){
    "use strict"

    var path, 
        index = events.elements.indexOf(el);

    if(index < 0){
        path = elementXPath(el);
        
        if(path === undefined || path === null)
            throw new Error("unknown element path!");

        index = events.paths.push(path);
        
        if(events.elements.push(el) !== index)
            throw new Error("event table missalignment!");

        if(debug) console.log("register path(%s):", index ,path);

    } else {
        path = events.paths[index];
    }

    return path;
}

function xevent(path){
    "use strict"

    var ev = events.event[path];

    if(!ev){ 
        ev = events.event[path] = Object.create(null);
        ev.types = [];
    }

    return ev;
}

function attach(el,ev,fn,cap){
    "use strict"

    var path, event;

    path = xpath(el);

    event = xevent(path);

    if(event.types.indexOf(ev) < 0){
        event.types.push(ev);
        addEventListener(el,ev,dispatch,cap); 
    }

    path = path + '<'+ev+'>';

    if(typeof fn === 'object'){
        if(!event.augment) event.augment = Object.create(null);
        
        if(!event.augment[ev]) event.augment[ev] = Object.create(null);

        if(debug) console.log("augment:", path, fn);
        
        extend(event.augment[ev],fn);

        fn = fn.listener;
    } 

    if(typeof fn === 'function') {
        if(debug) console.log("attach:", path);

        Event.on(path,fn);
    }
}

function dispatch(event){

    var path, augment;

    path = xpath(this);

    augment = events.event[path].augment;

    event = Event.normalize(event); 

    path+= '<'+event.type+'>';

    if(debug) console.log("dispatch:", path);

    if(augment && augment[event.type]){ 
        extend(event,augment[event.type]);
    }
    
    Event.emit(this,path,event);
}


function detach(el,ev,fn){
    "use strict"

    var path, event;

    path = xpath(el);

    event = xevent(path);

    path+= '<'+ev+'>';

    if(debug) console.log("detach: %s with listeners(%s)", path, Event.listeners(path).length);

    Event.off(path,fn);

    if(!Event.hasListeners(path)) {
        index = event.types.indexOf(ev);
        if(index >= 0){
            event.types.splice(index,1);
        }
    }
}

function delegate(event){
    "use strict"

    var path = xpath(event.target);

    path+= '<'+event.type+'>';

    if(debug) console.log("delegate:", path);

    Event.emit(event.target,path,event);
}

function extend(e,o) {
    "use strict"

    for(var k in o) if(!e[k]) e[k] = o[k];

    return e;
}

function clone(ev,o) {
    "use strict"

    o = o ? o : Object.create(null);

    for (var p in ev) o[p] = ev[p];

    return o;
}

function elementXPath(el){
    "use strict"

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
