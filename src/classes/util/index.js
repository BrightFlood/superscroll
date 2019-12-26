/*
 * TODO: DOCS (private for dev)
 */


// TODO: temporary workaround for chrome's scroll jitter bug
typeof(window) !== 'undefined' && window.addEventListener("mousewheel", function () {});

// global const
export const PIN_SPACER_ATTRIBUTE = "data-scrollmagic-pin-spacer";

let
loglevels = ["error", "warn", "log"],
console = window.console || {};

let i;
// (BUILD) - REMOVE IN MINIFY - START
console.log = console.log || function(){}; // no console log, well - do nothing then...
// make sure methods for all levels exist.
for(i = 0; i<loglevels.length; i++) {
	var method = loglevels[i];
	if (!console[method]) {
		console[method] = console.log; // prefer .log over nothing
	}
}
// (BUILD) - REMOVE IN MINIFY - END

/**
 * ------------------------------
 * type testing
 * ------------------------------
 */
export class Type {
	static type(v) {
		return Object.prototype.toString.call(v).replace(/^\[object (.+)\]$/, "$1").toLowerCase();
	};

	static String = function (v) {
		return Type.type(v) === 'string';
	};
	static Function = function (v) {
		return Type.type(v) === 'function';
	};
	static Array = function (v) {
		return Array.isArray(v);
	};
	static Number = function (v) {
		return !Type.Array(v) && (v - parseFloat(v) + 1) >= 0;
	};
	static DomElement = function (o){
		return (
			typeof HTMLElement === "object" || typeof HTMLElement === "function"? o instanceof HTMLElement || o instanceof SVGElement : //DOM2
			o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
		);
	};
}

let _requestAnimationFrame = window.requestAnimationFrame.bind(window);
let _cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
let _rAF = _requestAnimationFrame;
let _cAF = _cancelAnimationFrame;
export class Util {
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
  	static getComputedStyle(elem) {
	  return elem.currentStyle ? elem.currentStyle : window.getComputedStyle(elem);
  	};

  	// get element dimension (width or height)
	static dimension(which, elem, outer, includeMargin) {
	  elem = (elem === document) ? window : elem;
	  if (elem === window) {
		  includeMargin = false;
	  } else if (!Type.DomElement(elem)) {
		  return 0;
	  }
	  which = which.charAt(0).toUpperCase() + which.substr(1).toLowerCase();
	  var dimension = (outer ? elem['offset' + which] || elem['outer' + which] : elem['client' + which] || elem['inner' + which]) || 0;
	  if (outer && includeMargin) {
		  var style = Util._getComputedStyle(elem);
		  dimension += which === 'Height' ?  Util.floatval(style.marginTop) + Util.floatval(style.marginBottom) : Util.floatval(style.marginLeft) + Util.floatval(style.marginRight);
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

	// check if a css display type results in margin-collapse or not
	static isMarginCollapseType(str) {
		return ["block", "flex", "list-item", "table", "-webkit-box"].indexOf(str) > -1;
	};

	static get rAF() {
		return _rAF;
	}

	static get cAF() {
		return _cAF;
	}

	static overrideRequestAnimationFrame() {
		// implementation of requestAnimationFrame
		// based on https://gist.github.com/paulirish/1579671
		var
			lastTime = 0,
			vendors = ['ms', 'moz', 'webkit', 'o'];
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
		_rAF = _requestAnimationFrame.bind(window);
		_cAF = _cancelAnimationFrame.bind(window);
	}

	static get get() {
		return Get;
	}
	
	// (BUILD) - REMOVE IN MINIFY - START
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
}
Util.overrideRequestAnimationFrame();

/**
 * ------------------------------
 * DOM Element info
 * ------------------------------
 */
export class Get {

	// always returns a list of matching DOM elements, from a selector, a DOM element or an list of elements or even an array of selectors
	static elements = function (selector) {
		var arr = [];
		if (Type.String(selector)) {
			try {
				selector = document.querySelectorAll(selector);
			} catch (e) { // invalid selector
				return arr;
			}
		}
		if (Type.type(selector) === 'nodelist' || Type.Array(selector) || selector instanceof NodeList) {
			for (var i = 0, ref = arr.length = selector.length; i < ref; i++) { // list of elements
				var elem = selector[i];
				arr[i] = Type.DomElement(elem) ? elem : Get.elements(elem); // if not an element, try to resolve recursively
			}
		} else if (Type.DomElement(selector) || selector === document || selector === window){
			arr = [selector]; // only the element
		}
		return arr;
	};
	// get scroll top value
	static scrollTop = function (elem) {
		return (elem && typeof elem.scrollTop === 'number') ? elem.scrollTop : window.pageYOffset || 0;
	};
	// get scroll left value
	static scrollLeft = function (elem) {
		return (elem && typeof elem.scrollLeft === 'number') ? elem.scrollLeft : window.pageXOffset || 0;
	};
	// get element height
	static width = function (elem, outer, includeMargin) {
		return Util.dimension('width', elem, outer, includeMargin);
	};
	// get element width
	static height = function (elem, outer, includeMargin) {
		return Util.dimension('height', elem, outer, includeMargin);
	};

	// get element position (optionally relative to viewport)
	static offset = function (elem, relativeToViewport) {
		var offset = {top: 0, left: 0};
		if (elem && elem.getBoundingClientRect) { // check if available
			var rect = elem.getBoundingClientRect();
			offset.top = rect.top;
			offset.left = rect.left;
			if (!relativeToViewport) { // clientRect is by default relative to viewport...
				offset.top += Get.scrollTop();
				offset.left += Get.scrollLeft();
			}
		}
		return offset;
	};
}

/**
 * ------------------------------
 * DOM Element manipulation
 * ------------------------------
 */

export class Set {
	static addClass(elem, classname) {
		if (classname) {
			if (elem.classList)
				elem.classList.add(classname);
			else
				elem.className += ' ' + classname;
		}
	};
	static removeClass(elem, classname) {
		if (classname) {
			if (elem.classList)
				elem.classList.remove(classname);
			else
				elem.className = elem.className.replace(new RegExp('(^|\\b)' + classname.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
		}
	};

	// if options is string -> returns css value
	// if options is array -> returns object with css value pairs
	// if options is object -> set new css values
	static css(elem, options) {
		if (Type.String(options)) {
			return Util._getComputedStyle(elem)[Util._camelCase(options)];
		} else if (Type.Array(options)) {
			var
				obj = {},
				style = Util._getComputedStyle(elem);
			options.forEach(function(option, key) {
				obj[option] = style[Util._camelCase(option)];
			});
			return obj;
		} else {
			for (var option in options) {
				var val = options[option];
				if (val === parseFloat(val)) { // assume pixel for seemingly numerical values
					val += 'px';
				}
				elem.style[Util._camelCase(option)] = val;
			}
		}
	};
}