var Emitter = require('emitter');

var augments, events = {elements:[],paths:[],event:{}};

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
            if (event.clientX != null) {
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
            if (event.button != null) {
                event.button = (event.button & 1 ? 0 : (event.button & 4 ? 1 : (event.button & 2 ? 2 : 0)));
            }
            // mouse scroll
            event.wheelDelta = event.wheelDelta || -event.Detail * 40; 
        }    
        // note: Use Event.augment(...); to add user defined event attributes/methods
        return augments ? extend(event,augments) : event; 
    },
    bind: function(el,ev,fn,cap){
        ev = ev.split(' ');

        for(var i = 0, l = ev.length; i < l; i++) attach(el,ev[i],fn,cap);
    },
    unbind: function(el,ev,fn){
        ev = ev.split(' ');

        for(var i = 0, l = ev.length; i < l; i++) detach(el,ev[i],fn);
    },
    add: function(el,ev,fn,cap){
        this.bind(el,ev,fn,cap);
    },
    remove: function(el,ev,fn){
        this.unbind(el,ev,fn);
    },
    debug: function(on){
        debug = !!on;
    }
});

Object.defineProperty(Event,'augment',{
    get: function(){
        return augments;
    },
    set: function(o,r){
        if(typeof o === 'string' && r) {
            if(augments && augments.hasOwnProperty(o))
                delete augments[o];
        }

        if(typeof o === 'function' && o.name){
           r = {};
           r[o.name] = o;
           o = r; 
        }

        if(typeof o !== 'object') return;

        if(!augments) augments = Object.create(null);

        return extend(augments,o);
    }
});

function addEventListener(el,ev,fn,cap){
    if(el.addEventListener){
        el.addEventListener(ev, fn, !!cap);
    } else if (el.attachEvent){
        el.attachEvent('on' + ev, fn);
    }  else el['on' + ev] = fn;

    return el;
}

function removeEventListener(el,ev,fn){
    if(el.removeEventListener){
        el.removeEventListener(ev, fn, false);
    } else if (el.detachEvent){
        el.detachEvent('on' + ev, fn);
    } else el['on' + ev] = null;

    return el;
}

function attach(el,ev,fn,cap){
    var index, path;

    if((index = events.elements.indexOf(el)) < 0){
        events.elements.push(el);
        path = elementXPath(el);
        index = events.paths.push(path) -1;
    } else path = events.paths[index];

    if(!events.event[path]) events.event[path] = [];

    if(events.event[path].indexOf(ev) < 0){
        events.event[path].push(ev);
        addEventListener(el,ev,dispatch,cap);
    } 

    path = path + '<'+ev+'>';

    if(debug) console.log("attach(%s):", index, path);

    Event.on(path,fn);
}

function dispatch(event){
    var index, path;

    event = Event.normalize(event);

    if((index = events.elements.indexOf(this)) < 0){
        throw new Error("Dispatch failed: unknown element");
    }

    path = events.paths[index] + '<'+event.type+'>';

    if(debug) console.log("dispatch(%s):", index, path);

    Event.emit(path,event);
}


function detach(el,ev,fn){
    var index, path;
    if((index = events.elements.indexOf(el)) < 0){
        throw new Error("Detach failed, unable to locate element");
    }

    path = events.paths[index] + '<'+ev+'>';

    if(debug) console.log("detach(%s):", index, path);

    Event.off(path,fn);
}

function extend(e,o) {
    for(var k in o) if(!e[k]) e[k] = o[k];

    return e;
}

function clone(ev,o) {
    o = o ? o : Object.create(null);

    for (var p in ev) o[p] = ev[p];

    return o;
}

// https://code.google.com/p/fbug/source/browse/branches/firebug1.6/content/firebug/lib.js?spec=svn12950&r=8828#1332
function elementXPath(el){
    var i, p = [], tag, index;

    if(el === window) return '';
    if(el === document) return '/';

    for (; el && el.nodeType == 1; el = el.parentNode){
        i = 0;
        for (var n = el.previousSibling; n; n = n.previousSibling){
            if (n.nodeType == Node.DOCUMENT_TYPE_NODE) continue;

            if (n.nodeName == el.nodeName) ++i;
        }

        tag = el.nodeName.toLowerCase();
        index = (i ? "[" + (i+1) + "]" : "");
        p.splice(0, 0, tag + index);
    }

    return p.length ? "/" + p.join("/") : null;
}

module.exports = Event; 
