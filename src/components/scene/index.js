import React, {Component} from 'react';
import _util from '../../util';

export class Scene extends Component{
	static SCENE_OPTIONS = {
		defaults: {
			duration: 0,
			offset: 0,
			triggerElement: undefined,
			triggerHook: 0.5,
			reverse: true,
			loglevel: 2
		},
		validate: {
			offset : function (val) {
				val = parseFloat(val);
				if (!_util.type.Number(val)) {
					throw ["Invalid value for option \"offset\":", val];
				}
				return val;
			},
			triggerElement : function (val) {
				val = val || undefined;
				if (val) {
					var elem = _util.get.elements(val)[0];
					if (elem && elem.parentNode) {
						val = elem;
					} else {
						throw ["Element defined in option \"triggerElement\" was not found:", val];
					}
				}
				return val;
			},
			triggerHook : function (val) {
				var translate = {"onCenter" : 0.5, "onEnter" : 1, "onLeave" : 0};
				if (_util.type.Number(val)) {
					val = Math.max(0, Math.min(parseFloat(val), 1)); //  make sure its betweeen 0 and 1
				} else if (val in translate) {
					val = translate[val];
				} else {
					throw ["Invalid value for option \"triggerHook\": ", val];
				}
				return val;
			},
			reverse: function (val) {
				return !!val; // force boolean
			},
			// (BUILD) - REMOVE IN MINIFY - START
			loglevel: function (val) {
				val = parseInt(val);
				if (!_util.type.Number(val) || val < 0 || val > 3) {
					throw ["Invalid value for option \"loglevel\":", val];
				}
				return val;
			}
			// (BUILD) - REMOVE IN MINIFY - END
		}, // holder for  validation methods. duration validation is handled in 'getters-setters.js'
		shifts: ["duration", "offset", "triggerHook"], // list of options that trigger a `shift` event
	};
	static NAMESPACE = 'ScrollMagic.Scene';
	static SCENE_STATE_BEFORE = 'BEFORE';
	static SCENE_STATE_DURING = 'DURING';
	static SCENE_STATE_AFTER = 'AFTER';
	static DEFAULT_OPTIONS = Scene.SCENE_OPTIONS.defaults;
	
	constructor(props) {
		super(props);

		this._options = _util.extend({}, Scene.DEFAULT_OPTIONS, props.options);
		this._state = Scene.SCENE_STATE_BEFORE;
		this._progress = 0;
		this._scrollOffset = {start: 0, end: 0}; // reflects the controllers's scroll position for the start and end of the scene respectively
		this._triggerPos = 0;
		this._enabled = true;
		const _durationUpdateMethod = this._durationUpdateMethod = null;
		const _controller = this._controller = null;
		this._listeners = {};
		this._cssClasses = null;
		this._cssClassElems = [];
		this._pin = null;
		this._pinOptions = null;
		this._validate = _util.extend(Scene.SCENE_OPTIONS.validate, {
			// validation for duration handled internally for reference to private var _durationMethod
			duration : function (val) {
				if (_util.type.String(val) && val.match(/^(\.|\d)*\d+%$/)) {
					// percentage value
					var perc = parseFloat(val) / 100;
					val = function () {
						return _controller ? _controller.info("size") * perc : 0;
					};
				}
				if (_util.type.Function(val)) {
					// function
					_durationUpdateMethod = val;
					try {
						val = parseFloat(_durationUpdateMethod.call(Scene));
					} catch (e) {
						val = -1; // will cause error below
					}
				}
				// val has to be float
				val = parseFloat(val);
				if (!_util.type.Number(val) || val < 0) {
					if (_durationUpdateMethod) {
						_durationUpdateMethod = undefined;
						throw ["Invalid return value of supplied function for option \"duration\":", val];
					} else {
						throw ["Invalid value for option \"duration\":", val];
					}
				}
				return val;
			}
		});
	}

	controller() {
		return this._controller;
	};

	state() {
		return this._state;
	};

	scrollOffset() {
		return this._scrollOffset.start;
	};

	// set event listeners
	/*
	Scene
		.on("change.internal", function (e) {
			if (e.what !== "loglevel" && e.what !== "tweenChanges") { // no need for a scene update scene with these options...
				if (e.what === "triggerElement") {
					updateTriggerElementPosition();
				} else if (e.what === "reverse") { // the only property left that may have an impact on the current scene state. Everything else is handled by the shift event.
					Scene.update();
				}
			}
		})
		.on("shift.internal", function (e) {
			updateScrollOffset();
			Scene.update(); // update scene to reflect new position
		});

	Scene
		.on("destroy.internal", function (e) {
			Scene.removeClassToggle(e.reset);
		});
	
	Scene
		.on("shift.internal", function (e) {
			var durationChanged = e.reason === "duration";
			if ((_state === SCENE_STATE_AFTER && durationChanged) || (_state === SCENE_STATE_DURING && _options.duration === 0)) {
				// if [duration changed after a scene (inside scene progress updates pin position)] or [duration is 0, we are in pin phase and some other value changed].
				updatePinState();
			}
			if (durationChanged) {
				updatePinDimensions();
			}
		})
		.on("progress.internal", function (e) {
			updatePinState();
		})
		.on("add.internal", function (e) {
			updatePinDimensions();
		})
		.on("destroy.internal", function (e) {
			Scene.removePin(e.reset);
		});
	*/

	construct() {
		const {
			DEFAULT_OPTIONS
		} = Scene;
		
		const {
			_options,
			addSceneOption,
			validateOption,
			log,
		} = this;

		for (var key in _options) { // check supplied options
			if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
				log(2, "WARNING: Unknown option \"" + key + "\"");
				delete _options[key];
			}
		}
		
		// add getters/setters for all possible options
		for (var optionName in DEFAULT_OPTIONS) {
			addSceneOption(optionName);
		}
		// validate all options
		validateOption();
	};

	addOption(name, defaultValue, validationCallback, shifts) {
		const {
			SCENE_OPTIONS
		} = Scene;

		if (!(name in SCENE_OPTIONS.defaults)) {
			SCENE_OPTIONS.defaults[name] = defaultValue;
			SCENE_OPTIONS.validate[name] = validationCallback;
			if (shifts) {
				SCENE_OPTIONS.shifts.push(name);
			}
		} else {
			_util.log(1, "[static] ScrollMagic.Scene -> Cannot add Scene option '" + name + "', because it already exists.");
		}
	};

	// instance extension function for plugins
	/*
	extend(extension) {
		var oldClass = this;
		ScrollMagic.Scene = function () {
			oldClass.apply(this, arguments);
			this.$super = _util.extend({}, this); // copy parent state
			return extension.apply(this, arguments) || this;
		};
		_util.extend(ScrollMagic.Scene, oldClass); // copy properties
		ScrollMagic.Scene.prototype = oldClass.prototype; // copy prototype
		ScrollMagic.Scene.prototype.constructor = ScrollMagic.Scene; // restore constructor
	};
	*/
	
	// (BUILD) - REMOVE IN MINIFY - START
	log(loglevel, output) {
		const {
			NAMESPACE
		} = Scene;
		
		const {
			_options,
		} = this;
		
		if (_options.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			_util.log.apply(window, arguments);
		}
	};
	// (BUILD) - REMOVE IN MINIFY - END

	/*
	TODO: pass in required refs from controller to children
	*/
	addTo(controller) {
		/*
		if (!(controller instanceof ScrollMagic.Controller)) {
			log(1, "ERROR: supplied argument of 'addTo()' is not a valid ScrollMagic Controller");
		} else if (_controller != controller) {
			// new controller
			if (_controller) { // was associated to a different controller before, so remove it...
				_controller.removeScene(Scene);
			}
			_controller = controller;
			validateOption();
			updateDuration(true);
			updateTriggerElementPosition(true);
			updateScrollOffset();
			_controller.info("container").addEventListener('resize', onContainerResize);
			controller.addScene(Scene);
			Scene.trigger("add", {controller: _controller});
			log(3, "added " + NAMESPACE + " to controller");
			Scene.update();
		}
		return Scene;
		*/
	};

	enabled(newState) {
		const {
			_enabled,
		} = this;

		if (!arguments.length) { // get
			return _enabled;
		} else if (_enabled != newState) { // set
			_enabled = !!newState;
			Scene.update(true);
		}
		return Scene;
	};

	remove() {
		const {
			NAMESPACE
		} = Scene;
		
		const {
			_controller,
			onContainerResize,
			log,
		} = this;

		if (_controller) {
			_controller.info("container").removeEventListener('resize', onContainerResize);
			var tmpParent = _controller;
			_controller = undefined;
			tmpParent.removeScene(Scene);
			Scene.trigger("remove");
			log(3, "removed " + NAMESPACE + " from controller");
		}
		return Scene;
	};

	destroy(reset) {
		const {
			NAMESPACE
		} = Scene;
		
		const {
			trigger,
			remove,
			off,
			log
		} = this;

		trigger("destroy", {reset: reset});
		remove();
		off("*.*");
		log(3, "destroyed " + NAMESPACE + " (reset: " + (reset ? "true" : "false") + ")");
		return null;
	};

	update(immediately) {
		const {
			SCENE_STATE_DURING
		} = Scene;
		
		const {
			_options,
			_controller,
			_enabled,
			_scrollOffset,
			_pin,
			_state,
			updatePinState,
			updateDuration
		} = this;

		if (_controller) {
			if (immediately) {
				if (_controller.enabled() && _enabled) {
					var
						scrollPos = _controller.info("scrollPos"),
						newProgress;

					if (_options.duration > 0) {
						newProgress = (scrollPos - _scrollOffset.start)/(_scrollOffset.end - _scrollOffset.start);
					} else {
						newProgress = scrollPos >= _scrollOffset.start ? 1 : 0;
					}

					Scene.trigger("update", {startPos: _scrollOffset.start, endPos: _scrollOffset.end, scrollPos: scrollPos});

					Scene.progress(newProgress);
				} else if (_pin && _state === SCENE_STATE_DURING) {
					updatePinState(true); // unpin in position
				}
			} else {
				_controller.updateScene(Scene, false);
			}
		}
		return Scene;
	};

	refresh() {
		const {
			updateDuration,
			updateTriggerElementPosition,
		} = this;

		updateDuration();
		updateTriggerElementPosition();
		// update trigger element position
		return Scene;
	};

	progress(progress) {
		const {
			SCENE_STATE_DURING,
			SCENE_STATE_AFTER,
			SCENE_STATE_BEFORE
		} = Scene;
		
		const {
			_options,
			_progress,
			_controller,
			_state,
			updatePinState
		} = this;

		if (!arguments.length) { // get
			return _progress;
		} else { // set
			var
				doUpdate = false,
				oldState = _state,
				scrollDirection = _controller ? _controller.info("scrollDirection") : 'PAUSED',
				reverseOrForward = _options.reverse || progress >= _progress;
			if (_options.duration === 0) {
				// zero duration scenes
				doUpdate = _progress != progress;
				_progress = progress < 1 && reverseOrForward ? 0 : 1;
				_state = _progress === 0 ? SCENE_STATE_BEFORE : SCENE_STATE_DURING;
			} else {
				// scenes with start and end
				if (progress < 0 && _state !== SCENE_STATE_BEFORE && reverseOrForward) {
					// go back to initial state
					_progress = 0;
					_state = SCENE_STATE_BEFORE;
					doUpdate = true;
				} else if (progress >= 0 && progress < 1 && reverseOrForward) {
					_progress = progress;
					_state = SCENE_STATE_DURING;
					doUpdate = true;
				} else if (progress >= 1 && _state !== SCENE_STATE_AFTER) {
					_progress = 1;
					_state = SCENE_STATE_AFTER;
					doUpdate = true;
				} else if (_state === SCENE_STATE_DURING && !reverseOrForward) {
					updatePinState(); // in case we scrolled backwards mid-scene and reverse is disabled => update the pin position, so it doesn't move back as well.
				}
			}
			if (doUpdate) {
				// fire events
				var
					eventVars = {progress: _progress, state: _state, scrollDirection: scrollDirection},
					stateChanged = _state != oldState;

				var trigger = function (eventName) { // tmp helper to simplify code
					Scene.trigger(eventName, eventVars);
				};

				if (stateChanged) { // enter events
					if (oldState !== SCENE_STATE_DURING) {
						trigger("enter");
						trigger(oldState === SCENE_STATE_BEFORE ? "start" : "end");
					}
				}
				trigger("progress");
				if (stateChanged) { // leave events
					if (_state !== SCENE_STATE_DURING) {
						trigger(_state === SCENE_STATE_BEFORE ? "start" : "end");
						trigger("leave");
					}
				}
			}

			return Scene;
		}
	}

	on(names, callback) {
		const {
			_listeners,
			log
		} = this;

		if (_util.type.Function(callback)) {
			names = names.trim().split(' ');
			names.forEach(function (fullname) {
				var
					nameparts = fullname.split('.'),
					eventname = nameparts[0],
					namespace = nameparts[1];
				if (eventname != "*") { // disallow wildcards
					if (!_listeners[eventname]) {
						_listeners[eventname] = [];
					}
					_listeners[eventname].push({
						namespace: namespace || '',
						callback: callback
					});
				}
			});
		} else {
			log(1, "ERROR when calling '.on()': Supplied callback for '" + names + "' is not a valid function!");
		}
		return Scene;
	};

	off(names, callback) {
		const {
			_listeners,
			log
		} = this;

		if (!names) {
			log(1, "ERROR: Invalid event name supplied.");
			return Scene;
		}
		names = names.trim().split(' ');
		names.forEach(function (fullname, key) {
			var
				nameparts = fullname.split('.'),
				eventname = nameparts[0],
				namespace = nameparts[1] || '',
				removeList = eventname === '*' ? Object.keys(_listeners) : [eventname];
			removeList.forEach(function (remove){
				var
					list = _listeners[remove] || [],
					i = list.length;
				while(i--) {
					var listener = list[i];
					if (listener && (namespace === listener.namespace || namespace === '*') && (!callback || callback == listener.callback)) {
						list.splice(i, 1);
					}
				}
				if (!list.length) {
					delete _listeners[remove];
				}
			});
		});
		return Scene;
	};

	trigger(name, vars) {
		const {
			_listeners,
			log
		} = this;

		if (name) {
			var
				nameparts = name.trim().split('.'),
				eventname = nameparts[0],
				namespace = nameparts[1],
				listeners = _listeners[eventname];
			log(3, 'event fired:', eventname, vars ? "->" : '', vars || '');
			if (listeners) {
				listeners.forEach(function (listener, key) {
					if (!namespace || namespace === listener.namespace) {
						//TODO fix this
						//listener.callback.call(Scene, new ScrollMagic.Event(eventname, listener.namespace, Scene, vars));
					}
				});
			}
		} else {
			log(1, "ERROR: Invalid event name supplied.");
		}
		return Scene;
	};
	
	setClassToggle(element, classes) {
		const {
			log
		} = this;

		var elems = _util.get.elements(element);
		if (elems.length === 0 || !_util.type.String(classes)) {
			log(1, "ERROR calling method 'setClassToggle()': Invalid " + (elems.length === 0 ? "element" : "classes") + " supplied.");
			return Scene;
		}
		if (this._cssClassElems.length > 0) {
			// remove old ones
			Scene.removeClassToggle();
		}
		this._cssClasses = classes;
		this._cssClassElems = elems;
		Scene.on("enter.internal_class leave.internal_class", function (e) {
			var toggle = e.type === "enter" ? _util.addClass : _util.removeClass;
			this._cssClassElems.forEach(function (elem, key) {
				toggle(elem, this._cssClasses);
			});
		});
		return Scene;
	};

	removeClassToggle(reset) {
		const {
			log,
			_cssClassElems,
			_cssClasses
		} = this;

		if (reset) {
			_cssClassElems.forEach(function (elem, key) {
				_util.removeClass(elem, _cssClasses);
			});
		}
		Scene.off("start.internal_class end.internal_class");
		this._cssClasses = undefined;
		this._cssClassElems = [];
		return Scene;
	};

	updatePinState(forceUnpin) {
		const {
			SCENE_STATE_DURING,
			SCENE_STATE_BEFORE,
			SCENE_STATE_AFTER,
		} = Scene;

		const {
			_options,
			_scrollOffset,
			_progress,
			_pin,
			_pinOptions,
			_controller,
			_state,
			updatePinDimensions,
		} = this;

		if (_pin && _controller) {
			var 
				containerInfo = _controller.info(),
				pinTarget = _pinOptions.spacer.firstChild; // may be pin element or another spacer, if cascading pins

			if (!forceUnpin && _state === SCENE_STATE_DURING) { // during scene or if duration is 0 and we are past the trigger
				// pinned state
				if (_util.css(pinTarget, "position") != "fixed") {
					// change state before updating pin spacer (position changes due to fixed collapsing might occur.)
					_util.css(pinTarget, {"position": "fixed"});
					// update pin spacer
					updatePinDimensions();
				}

				var
					fixedPos = _util.get.offset(_pinOptions.spacer, true), // get viewport position of spacer
					scrollDistance = _options.reverse || _options.duration === 0 ?
										containerInfo.scrollPos - _scrollOffset.start // quicker
									: Math.round(_progress * _options.duration * 10)/10; // if no reverse and during pin the position needs to be recalculated using the progress
				
				// add scrollDistance
				fixedPos[containerInfo.vertical ? "top" : "left"] += scrollDistance;

				// set new values
				_util.css(_pinOptions.spacer.firstChild, {
					top: fixedPos.top,
					left: fixedPos.left
				});
			} else {
				// unpinned state
				var
					newCSS = {
						position: _pinOptions.inFlow ? "relative" : "absolute",
						top:  0,
						left: 0
					},
					change = _util.css(pinTarget, "position") != newCSS.position;
				
				if (!_pinOptions.pushFollowers) {
					newCSS[containerInfo.vertical ? "top" : "left"] = _options.duration * _progress;
				} else if (_options.duration > 0) { // only concerns scenes with duration
					if (_state === SCENE_STATE_AFTER && parseFloat(_util.css(_pinOptions.spacer, "padding-top")) === 0) {
						change = true; // if in after state but havent updated spacer yet (jumped past pin)
					} else if (_state === SCENE_STATE_BEFORE && parseFloat(_util.css(_pinOptions.spacer, "padding-bottom")) === 0) { // before
						change = true; // jumped past fixed state upward direction
					}
				}
				// set new values
				_util.css(pinTarget, newCSS);
				if (change) {
					// update pin spacer if state changed
					updatePinDimensions();
				}
			}
		}
	};

	updatePinDimensions() {
		const {
			SCENE_STATE_DURING,
			SCENE_STATE_BEFORE,
			SCENE_STATE_AFTER,
		} = Scene;

		const {
			_options,
			_progress,
			_pin,
			_pinOptions,
			_controller,
			_state,
		} = this;

		if (_pin && _controller && _pinOptions.inFlow) { // no spacerresize, if original position is absolute
			var
				after = (_state === SCENE_STATE_AFTER),
				before = (_state === SCENE_STATE_BEFORE),
				during = (_state === SCENE_STATE_DURING),
				vertical = _controller.info("vertical"),
				pinTarget = _pinOptions.spacer.firstChild, // usually the pined element but can also be another spacer (cascaded pins)
				marginCollapse = _util.isMarginCollapseType(_util.css(_pinOptions.spacer, "display")),
				css = {};

			// set new size
			// if relsize: spacer -> pin | else: pin -> spacer
			if (_pinOptions.relSize.width || _pinOptions.relSize.autoFullWidth) {
				if (during) {
					_util.css(_pin, {"width": _util.get.width(_pinOptions.spacer)});
				} else {
					_util.css(_pin, {"width": "100%"});
				}
			} else {
				// minwidth is needed for cascaded pins.
				css["min-width"] = _util.get.width(vertical ? _pin : pinTarget, true, true);
				css.width = during ? css["min-width"] : "auto";
			}
			if (_pinOptions.relSize.height) {
				if (during) {
					// the only padding the spacer should ever include is the duration (if pushFollowers = true), so we need to substract that.
					_util.css(_pin, {"height": _util.get.height(_pinOptions.spacer) - (_pinOptions.pushFollowers ? _options.duration : 0)});
				} else {
					_util.css(_pin, {"height": "100%"});
				}
			} else {
				// margin is only included if it's a cascaded pin to resolve an IE9 bug
				css["min-height"] = _util.get.height(vertical ? pinTarget : _pin, true , !marginCollapse); // needed for cascading pins
				css.height = during ? css["min-height"] : "auto";
			}

			// add space for duration if pushFollowers is true
			if (_pinOptions.pushFollowers) {
				css["padding" + (vertical ? "Top" : "Left")] = _options.duration * _progress;
				css["padding" + (vertical ? "Bottom" : "Right")] = _options.duration * (1 - _progress);
			}
			_util.css(_pinOptions.spacer, css);
		}
	};

	updatePinInContainer() {
		const {
			SCENE_STATE_DURING,
		} = Scene;

		const {
			_pin,
			_controller,
			_state,
			updatePinState,
		} = this;

		if (_controller && _pin && _state === SCENE_STATE_DURING && !_controller.info("isDocument")) {
			updatePinState();
		}
	};

	updateRelativePinSpacer() {
		const {
			SCENE_STATE_DURING,
		} = Scene;

		const {
			_pin,
			_pinOptions,
			_controller,
			_state,
			updatePinDimensions,
		} = this;

		if ( _controller && _pin && // well, duh
				_state === SCENE_STATE_DURING && // element in pinned state?
				( // is width or height relatively sized, but not in relation to body? then we need to recalc.
					((_pinOptions.relSize.width || _pinOptions.relSize.autoFullWidth) && _util.get.width(window) != _util.get.width(_pinOptions.spacer.parentNode)) ||
					(_pinOptions.relSize.height && _util.get.height(window) != _util.get.height(_pinOptions.spacer.parentNode))
				)
		) {
			updatePinDimensions();
		}
	};

	onMousewheelOverPin(e) {
		const {
			SCENE_STATE_DURING,
		} = Scene;

		const {
			_pin,
			_controller,
			_state,
		} = this;

		if (_controller && _pin && _state === SCENE_STATE_DURING && !_controller.info("isDocument")) { // in pin state
			e.preventDefault();
			_controller._setScrollPos(_controller.info("scrollPos") - ((e.wheelDelta || e[_controller.info("vertical") ? "wheelDeltaY" : "wheelDeltaX"])/3 || -e.detail*30));
		}
	};

	setPin(element, settings) {
		const {
			PIN_SPACER_ATTRIBUTE
		} = Scene;

		const {
			_options,
			_pin,
			_pinOptions,
			log,
			updatePinState,
			updatePinInContainer,
			updateRelativePinSpacer,
			onMousewheelOverPin,
		} = this;

		var
			defaultSettings = {
				pushFollowers: true,
				spacerClass: "scrollmagic-pin-spacer"
			};
		// (BUILD) - REMOVE IN MINIFY - START
		var pushFollowersActivelySet = settings && settings.hasOwnProperty('pushFollowers');
		// (BUILD) - REMOVE IN MINIFY - END
		settings = _util.extend({}, defaultSettings, settings);

		// validate Element
		element = _util.get.elements(element)[0];
		if (!element) {
			log(1, "ERROR calling method 'setPin()': Invalid pin element supplied.");
			return Scene; // cancel
		} else if (_util.css(element, "position") === "fixed") {
			log(1, "ERROR calling method 'setPin()': Pin does not work with elements that are positioned 'fixed'.");
			return Scene; // cancel
		}

		if (_pin) { // preexisting pin?
			if (_pin === element) {
				// same pin we already have -> do nothing
				return Scene; // cancel
			} else {
				// kill old pin
				Scene.removePin();
			}
			
		}
		_pin = element;
		
		var
			parentDisplay = _pin.parentNode.style.display,
			boundsParams = ["top", "left", "bottom", "right", "margin", "marginLeft", "marginRight", "marginTop", "marginBottom"];

		_pin.parentNode.style.display = 'none'; // hack start to force css to return stylesheet values instead of calculated px values.
		var
			inFlow = _util.css(_pin, "position") != "absolute",
			pinCSS = _util.css(_pin, boundsParams.concat(["display"])),
			sizeCSS = _util.css(_pin, ["width", "height"]);
		_pin.parentNode.style.display = parentDisplay; // hack end.

		if (!inFlow && settings.pushFollowers) {
			log(2, "WARNING: If the pinned element is positioned absolutely pushFollowers will be disabled.");
			settings.pushFollowers = false;
		}
		// (BUILD) - REMOVE IN MINIFY - START
		window.setTimeout(function () { // wait until all finished, because with responsive duration it will only be set after scene is added to controller
			if (_pin && _options.duration === 0 && pushFollowersActivelySet && settings.pushFollowers) {
				log(2, "WARNING: pushFollowers =", true, "has no effect, when scene duration is 0.");
			}
		}, 0);
		// (BUILD) - REMOVE IN MINIFY - END

		// create spacer and insert
		var
			spacer = _pin.parentNode.insertBefore(document.createElement('div'), _pin),
			spacerCSS = _util.extend(pinCSS, {
					position: inFlow ? "relative" : "absolute",
					boxSizing: "content-box",
					mozBoxSizing: "content-box",
					webkitBoxSizing: "content-box"
				});

		if (!inFlow) { // copy size if positioned absolutely, to work for bottom/right positioned elements.
			_util.extend(spacerCSS, _util.css(_pin, ["width", "height"]));
		}

		_util.css(spacer, spacerCSS);
		spacer.setAttribute(PIN_SPACER_ATTRIBUTE, "");
		_util.addClass(spacer, settings.spacerClass);

		// set the pin Options
		_pinOptions = {
			spacer: spacer,
			relSize: { // save if size is defined using % values. if so, handle spacer resize differently...
				width: sizeCSS.width.slice(-1) === "%",
				height: sizeCSS.height.slice(-1) === "%",
				autoFullWidth: sizeCSS.width === "auto" && inFlow && _util.isMarginCollapseType(pinCSS.display)
			},
			pushFollowers: settings.pushFollowers,
			inFlow: inFlow, // stores if the element takes up space in the document flow
		};
		
		if (!_pin.___origStyle) {
			_pin.___origStyle = {};
			var
				pinInlineCSS = _pin.style,
				copyStyles = boundsParams.concat(["width", "height", "position", "boxSizing", "mozBoxSizing", "webkitBoxSizing"]);
			copyStyles.forEach(function (val) {
				_pin.___origStyle[val] = pinInlineCSS[val] || "";
			});
		}

		// if relative size, transfer it to spacer and make pin calculate it...
		if (_pinOptions.relSize.width) {
			_util.css(spacer, {width: sizeCSS.width});
		}
		if (_pinOptions.relSize.height) {
			_util.css(spacer, {height: sizeCSS.height});
		}

		// now place the pin element inside the spacer	
		spacer.appendChild(_pin);
		// and set new css
		_util.css(_pin, {
			position: inFlow ? "relative" : "absolute",
			margin: "auto",
			top: "auto",
			left: "auto",
			bottom: "auto",
			right: "auto"
		});
		
		if (_pinOptions.relSize.width || _pinOptions.relSize.autoFullWidth) {
			_util.css(_pin, {
				boxSizing : "border-box",
				mozBoxSizing : "border-box",
				webkitBoxSizing : "border-box"
			});
		}

		// add listener to document to update pin position in case controller is not the document.
		window.addEventListener('scroll', updatePinInContainer);
		window.addEventListener('resize', updatePinInContainer);
		window.addEventListener('resize', updateRelativePinSpacer);
		// add mousewheel listener to catch scrolls over fixed elements
		_pin.addEventListener("mousewheel", onMousewheelOverPin);
		_pin.addEventListener("DOMMouseScroll", onMousewheelOverPin);

		log(3, "added pin");

		// finally update the pin to init
		updatePinState();

		return Scene;
	};

	removePin(reset) {
		const {
			PIN_SPACER_ATTRIBUTE,
			SCENE_STATE_DURING,
		} = Scene;

		const {
			_pin,
			_pinOptions,
			_controller,
			_state,
			log,
			updatePinState,
			updatePinInContainer,
			updateRelativePinSpacer,
			onMousewheelOverPin,
		} = this;

		if (_pin) {
			if (_state === SCENE_STATE_DURING) {
				updatePinState(true); // force unpin at position
			}
			if (reset || !_controller) { // if there's no controller no progress was made anyway...
				var pinTarget = _pinOptions.spacer.firstChild; // usually the pin element, but may be another spacer (cascaded pins)...
				if (pinTarget.hasAttribute(PIN_SPACER_ATTRIBUTE)) { // copy margins to child spacer
					var
						style = _pinOptions.spacer.style,
						values = ["margin", "marginLeft", "marginRight", "marginTop", "marginBottom"],
						margins = {};
					values.forEach(function (val) {
						margins[val] = style[val] || "";
					});
					_util.css(pinTarget, margins);
				}
				_pinOptions.spacer.parentNode.insertBefore(pinTarget, _pinOptions.spacer);
				_pinOptions.spacer.parentNode.removeChild(_pinOptions.spacer);
				if (!_pin.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) { // if it's the last pin for this element -> restore inline styles
					// TODO: only correctly set for first pin (when cascading) - how to fix?
					_util.css(_pin, _pin.___origStyle);
					delete _pin.___origStyle;
				}
			}
			window.removeEventListener('scroll', updatePinInContainer);
			window.removeEventListener('resize', updatePinInContainer);
			window.removeEventListener('resize', updateRelativePinSpacer);
			_pin.removeEventListener("mousewheel", onMousewheelOverPin);
			_pin.removeEventListener("DOMMouseScroll", onMousewheelOverPin);
			_pin = undefined;
			log(3, "removed pin (reset: " + (reset ? "true" : "false") + ")");
		}
		return Scene;
	};

	validateOption(check) {
		const {
			DEFAULT_OPTIONS
		} = Scene;

		const {
			_validate,
			_options,
			log,
		} = this;

		check = arguments.length ? [check] : Object.keys(_validate);
		check.forEach(function (optionName, key) {
			var value;
			if (_validate[optionName]) { // there is a validation method for this option
				try { // validate value
					value = _validate[optionName](_options[optionName]);
				} catch (e) { // validation failed -> reset to default
					value = DEFAULT_OPTIONS[optionName];
					// (BUILD) - REMOVE IN MINIFY - START
					var logMSG = _util.type.String(e) ? [e] : e;
					if (_util.type.Array(logMSG)) {
						logMSG[0] = "ERROR: " + logMSG[0];
						logMSG.unshift(1); // loglevel 1 for error msg
						log.apply(this, logMSG);
					} else {
						log(1, "ERROR: Problem executing validation callback for option '" + optionName + "':", e.message);
					}
					// (BUILD) - REMOVE IN MINIFY - END
				} finally {
					_options[optionName] = value;
				}
			}
		});
	};

	changeOption(varname, newval) {
		const {
			_options,
			validateOption
		} = this;

		var
			changed = false,
			oldval = _options[varname];
		if (_options[varname] != newval) {
			_options[varname] = newval;
			validateOption(varname); // resets to default if necessary
			changed = oldval != _options[varname];
		}
		return changed;
	};

// generate getters/setters for all options
	addSceneOption(optionName) {
		const {
			SCENE_OPTIONS
		} = Scene;

		const {
			_options,
			_durationUpdateMethod,
			changeOption,
		} = this;

		if (!Scene[optionName]) {
			Scene[optionName] = function (newVal) {
				if (!arguments.length) { // get
					return _options[optionName];
				} else {
					if (optionName === "duration") { // new duration is set, so any previously set function must be unset
						_durationUpdateMethod = undefined;
					}
					if (changeOption(optionName, newVal)) { // set
						Scene.trigger("change", {what: optionName, newval: _options[optionName]});
						if (SCENE_OPTIONS.shifts.indexOf(optionName) > -1) {
							Scene.trigger("shift", {reason: optionName});
						}
					}
				}
				return Scene;
			};
		}
	};


	triggerPosition() {
		const {
			_options,
			_controller,
			_triggerPos,
		} = this;

		var pos = _options.offset; // the offset is the basis
		if (_controller) {
			// get the trigger position
			if (_options.triggerElement) {
				// Element as trigger
				pos += _triggerPos;
			} else {
				// return the height of the triggerHook to start at the beginning
				pos += _controller.info("size") * Scene.triggerHook();
			}
		}
		return pos;
	};

	updateScrollOffset() {
		const {
			_options,
			_controller,
			_triggerPos,
			_scrollOffset,
		} = this;

		_scrollOffset = {start: _triggerPos + _options.offset};
		if (_controller && _options.triggerElement) {
			// take away triggerHook portion to get relative to top
			_scrollOffset.start -= _controller.info("size") * _options.triggerHook;
		}
		_scrollOffset.end = _scrollOffset.start + _options.duration;
	};

	updateDuration(suppressEvents) {
		const {
			_options,
			_durationUpdateMethod,
			changeOption
		} = this;

		// update duration
		if (_durationUpdateMethod) {
			var varname = "duration";
			if (changeOption(varname, _durationUpdateMethod.call(Scene)) && !suppressEvents) { // set
				Scene.trigger("change", {what: varname, newval: _options[varname]});
				Scene.trigger("shift", {reason: varname});
			}
		}
	};

	updateTriggerElementPosition(suppressEvents) {
		const {
			PIN_SPACER_ATTRIBUTE
		} = Scene;

		const {
			_options,
			_controller,
			_triggerPos,
			log,
		} = this;

		var
			elementPos = 0,
			telem = _options.triggerElement;
		if (_controller && (telem || _triggerPos > 0)) { // either an element exists or was removed and the triggerPos is still > 0
			if (telem) { // there currently a triggerElement set
				if (telem.parentNode) { // check if element is still attached to DOM
					var
						controllerInfo = _controller.info(),
						containerOffset = _util.get.offset(controllerInfo.container), // container position is needed because element offset is returned in relation to document, not in relation to container.
						param = controllerInfo.vertical ? "top" : "left"; // which param is of interest ?
						
					// if parent is spacer, use spacer position instead so correct start position is returned for pinned elements.
					while (telem.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) {
						telem = telem.parentNode;
					}

					var elementOffset = _util.get.offset(telem);

					if (!controllerInfo.isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
						containerOffset[param] -= _controller.scrollPos();
					}

					elementPos = elementOffset[param] - containerOffset[param];

				} else { // there was an element, but it was removed from DOM
					log(2, "WARNING: triggerElement was removed from DOM and will be reset to", undefined);
					Scene.triggerElement(undefined); // unset, so a change event is triggered
				}
			}

			var changed = elementPos != _triggerPos;
			_triggerPos = elementPos;
			if (changed && !suppressEvents) {
				Scene.trigger("shift", {reason: "triggerElementPosition"});
			}
		}
	};

	onContainerResize(e) {
		if (this._options.triggerHook > 0) {
			this.trigger("shift", {reason: "containerResize"});
		}
	};

	render() {
		return <div>
			 scene
		</div>
  	}
}