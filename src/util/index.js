/*
 * TODO: DOCS (private for dev)
 */

// (BUILD) - REMOVE IN MINIFY - START
const loglevels = ["error", "warn", "log"]
const console = window.console || {};

console.log = console.log || function(){}; // no console log, well - do nothing then...
// make sure methods for all levels exist.
for(let i = 0; i<loglevels.length; i++) {
	var method = loglevels[i];
	if (!console[method]) {
		console[method] = console.log; // prefer .log over nothing
	}
}

class _util {

	/**
	 * ------------------------------
	 * internal helpers
	 * ------------------------------
	 */

	// parse float and fall back to 0.
	static floatval(number) {
		return parseFloat(number) || 0;
	};

	 // get current style IE safe (otherwise IE would return calculated values for 'auto')
	static _getComputedStyle(elem) {
		return elem.currentStyle ? elem.currentStyle : window.getComputedStyle(elem);
	};
	
	// get element dimension (width or height)
	static _dimension(which, elem, outer, includeMargin) {
		elem = (elem === document) ? window : elem;
		if (elem === window) {
			includeMargin = false;
		} else if (!_type.DomElement(elem)) {
			return 0;
		}
		which = which.charAt(0).toUpperCase() + which.substr(1).toLowerCase();
		var dimension = (outer ? elem['offset' + which] || elem['outer' + which] : elem['client' + which] || elem['inner' + which]) || 0;
		if (outer && includeMargin) {
			var style = _util._getComputedStyle(elem);
			dimension += which === 'Height' 
				?  	_util.floatval(style.marginTop)
					 + _util.floatval(style.marginBottom) 
				: 	_util.floatval(style.marginLeft) 
					+ _util.floatval(style.marginRight);
		}
		return dimension;
	};

	// converts 'margin-top' into 'marginTop'
	static _camelCase(str) {
		return str.replace(/^[^a-z]+([a-z])/g, '$1').replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
	};


	/**
	 * ------------------------------
	 * external helpers
	 * ------------------------------
	 */

	// extend obj – same as jQuery.extend({}, objA, objB)
	static extend(obj) {
		obj = obj || {};
		for (let i = 1; i < arguments.length; i++) {
			if (!arguments[i]) {
				continue;
			}
			for (var key in arguments[i]) {
				if (arguments[i].hasOwnProperty(key)) {
					obj[key] = arguments[i][key];
				}
			}
		}
		return obj;
	};

	// check if a css display type results in margin-collapse or not
	static isMarginCollapseType(str) {
		return ["block", "flex", "list-item", "table", "-webkit-box"].indexOf(str) > -1;
	};

	// implementation of requestAnimationFrame
	// based on https://gist.github.com/paulirish/1579671
	/*
		var
			lastTime = 0,
			vendors = ['ms', 'moz', 'webkit', 'o'];
		var _requestAnimationFrame = window.requestAnimationFrame;
		var _cancelAnimationFrame = window.cancelAnimationFrame;
		// try vendor prefixes if the above doesn't work
		for (i = 0; !_requestAnimationFrame && i < vendors.length; ++i) {
			_requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
			_cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame'] || window[vendors[i] + 'CancelRequestAnimationFrame'];
		}

		// fallbacks
		if (!_requestAnimationFrame) {
			_requestAnimationFrame = function (callback) {
				var
					currTime = new Date().getTime(),
					timeToCall = Math.max(0, 16 - (currTime - lastTime)),
					id = window.setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);
				lastTime = currTime + timeToCall;
				return id;
			};
		}
		if (!_cancelAnimationFrame) {
			_cancelAnimationFrame = function (id) {
				window.clearTimeout(id);
			};
		}
		U.rAF = _requestAnimationFrame.bind(window);
		U.cAF = _cancelAnimationFrame.bind(window);
	*/

	static log(loglevel) {
		if (loglevel > loglevels.length || loglevel <= 0) loglevel = loglevels.length;
		var now = new Date(),
			time = ("0"+now.getHours()).slice(-2) + ":" + ("0"+now.getMinutes()).slice(-2) + ":" + ("0"+now.getSeconds()).slice(-2) + ":" + ("00"+now.getMilliseconds()).slice(-3),
			method = loglevels[loglevel-1],
			args = Array.prototype.splice.call(arguments, 1),
			func = Function.prototype.bind.call(console[method], console);
		args.unshift(time);
		func.apply(console, args);
	};
	// (BUILD) - REMOVE IN MINIFY - END

	/**
	 * ------------------------------
	 * DOM Element manipulation
	 * ------------------------------
	 */

	static addClass(elem, classname) {
		if (classname) {
			if (elem.classList)
				elem.classList.add(classname);
			else
				elem.className += ' ' + classname;
		}
	}

	static removeClass(elem, classname) {
		if (classname) {
			if (elem.classList)
				elem.classList.remove(classname);
			else
				elem.className = elem.className.replace(new RegExp('(^|\\b)' + classname.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
		}
	}
	
	// if options is string -> returns css value
	// if options is array -> returns object with css value pairs
	// if options is object -> set new css values
	static css(elem, options) {
		if (_type.String(options)) {
			return _util._getComputedStyle(elem)[_util._camelCase(options)];
		} else if (_type.Array(options)) {
			var
				obj = {},
				style = _util._getComputedStyle(elem);
			options.forEach(function(option, key) {
				obj[option] = style[_util._camelCase(option)];
			});
			return obj;
		} else {
			for (var option in options) {
				var val = options[option];
				if (val === parseFloat(val)) { // assume pixel for seemingly numerical values
					val += 'px';
				}
				elem.style[_util._camelCase(option)] = val;
			}
		}
	}
}

/**
 * ------------------------------
 * type testing
 * ------------------------------
*/

class _type {
	static type(v) {
		return Object.prototype.toString.call(v).replace(/^\[object (.+)\]$/, "$1").toLowerCase();
	};

	static String(v) {
		return _type.type(v) === 'string';
	};
	
	static Function(v) {
		return _type.type(v) === 'function';
	};
	
	static Array(v) {
		return Array.isArray(v);
	};
	
	static Number(v) {
		return !_type.type.Array(v) && (v - parseFloat(v) + 1) >= 0;
	};
	
	static DomElement(o){
		return (
			typeof HTMLElement === "object" || typeof HTMLElement === "function"? o instanceof HTMLElement || o instanceof SVGElement : //DOM2
			o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
		);
	};
}
_util._type = _type;

/**
 * ------------------------------
 * DOM Element info
 * ------------------------------
 */
// always returns a list of matching DOM elements, from a selector, a DOM element or an list of elements or even an array of selectors
class _get {
	static elements(selector) {
		var arr = [];
		if (_type.String(selector)) {
			try {
				selector = document.querySelectorAll(selector);
			} catch (e) { // invalid selector
				return arr;
			}
		}
		if (_type.type(selector) === 'nodelist' || _type.Array(selector) || selector instanceof NodeList) {
			for (var i = 0, ref = arr.length = selector.length; i < ref; i++) { // list of elements
				var elem = selector[i];
				arr[i] = _type.DomElement(elem) ? elem : _get.elements(elem); // if not an element, try to resolve recursively
			}
		} else if (_type.DomElement(selector) || selector === document || selector === window){
			arr = [selector]; // only the element
		}
		return arr;
	};
	// get scroll top value
	static scrollTop(elem) {
		return (elem && typeof elem.scrollTop === 'number') ? elem.scrollTop : window.pageYOffset || 0;
	};
	// get scroll left value
	static scrollLeft(elem) {
		return (elem && typeof elem.scrollLeft === 'number') ? elem.scrollLeft : window.pageXOffset || 0;
	};
	// get element height
	static width(elem, outer, includeMargin) {
		return _util._dimension('width', elem, outer, includeMargin);
	};
	// get element width
	static height(elem, outer, includeMargin) {
		return _util._dimension('height', elem, outer, includeMargin);
	};

	// get element position (optionally relative to viewport)
	static offset(elem, relativeToViewport) {
		var offset = {top: 0, left: 0};
		if (elem && elem.getBoundingClientRect) { // check if available
			var rect = elem.getBoundingClientRect();
			offset.top = rect.top;
			offset.left = rect.left;
			if (!relativeToViewport) { // clientRect is by default relative to viewport...
				offset.top += _get.scrollTop();
				offset.left += _get.scrollLeft();
			}
		}
		return offset;
	};
}
_util._get = _get;

export default _util;