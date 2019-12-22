import {Type, Util, Get, PIN_SPACER_ATTRIBUTE} from '../../util';
import {Event} from '../../classes/event';
import {Controller} from '../controller';

// store pagewide scene options
var SCENE_OPTIONS = {
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
			if (!Type.Number(val)) {
				throw new Error(["Invalid value for option \"offset\":", val]);
			}
			return val;
		},
		triggerElement : function (val) {
			val = val || undefined;
			if (val) {
				var elem = Get.elements(val)[0];
				if (elem && elem.parentNode) {
					val = elem;
				} else {
					throw new Error(["Element defined in option \"triggerElement\" was not found:", val]);
				}
			}
			return val;
		},
		triggerHook : function (val) {
			var translate = {"onCenter" : 0.5, "onEnter" : 1, "onLeave" : 0};
			if (Type.Number(val)) {
				val = Math.max(0, Math.min(parseFloat(val), 1)); //  make sure its betweeen 0 and 1
			} else if (val in translate) {
				val = translate[val];
			} else {
				throw new Error(["Invalid value for option \"triggerHook\": ", val]);
			}
			return val;
		},
		reverse: function (val) {
			return !!val; // force boolean
		},
		// (BUILD) - REMOVE IN MINIFY - START
		loglevel: function (val) {
			val = parseInt(val);
			if (!Type.Number(val) || val < 0 || val > 3) {
				throw new Error(["Invalid value for option \"loglevel\":", val]);
			}
			return val;
		}
		// (BUILD) - REMOVE IN MINIFY - END
	}, // holder for  validation methods. duration validation is handled in 'getters-setters.js'
	shifts: ["duration", "offset", "triggerHook"], // list of options that trigger a `shift` event
};

/*
	* ----------------------------------------------------------------
	* settings
	* ----------------------------------------------------------------
	*/

var
	NAMESPACE = 'ScrollMagic.Scene',
	SCENE_STATE_BEFORE = 'BEFORE',
	SCENE_STATE_DURING = 'DURING',
	SCENE_STATE_AFTER = 'AFTER',
	DEFAULT_OPTIONS = SCENE_OPTIONS.defaults;

/**
 * A Scene defines where the controller should react and how.
 *
 * @class
 *
 * @example
 * // create a standard scene and add it to a controller
 * new ScrollMagic.Scene()
 *		.addTo(controller);
 *
 * // create a scene with custom options and assign a handler to it.
 * var scene = new ScrollMagic.Scene({
 * 		duration: 100,
 *		offset: 200,
 *		triggerHook: "onEnter",
 *		reverse: false
 * });
 *
 * @param {object} [options] - Options for the Scene. The options can be updated at any time.  
 							   Instead of setting the options for each scene individually you can also set them globally in the controller as the controllers `globalSceneOptions` option. The object accepts the same properties as the ones below.  
 							   When a scene is added to the controller the options defined using the Scene constructor will be overwritten by those set in `globalSceneOptions`.
 * @param {(number|string|function)} [options.duration=0] - The duration of the scene. 
 					Please see `Scene.duration()` for details.
 * @param {number} [options.offset=0] - Offset Value for the Trigger Position. If no triggerElement is defined this will be the scroll distance from the start of the page, after which the scene will start.
 * @param {(string|object)} [options.triggerElement=null] - Selector or DOM object that defines the start of the scene. If undefined the scene will start right at the start of the page (unless an offset is set).
 * @param {(number|string)} [options.triggerHook="onCenter"] - Can be a number between 0 and 1 defining the position of the trigger Hook in relation to the viewport.  
 															  Can also be defined using a string:
 															  ** `"onEnter"` => `1`
 															  ** `"onCenter"` => `0.5`
 															  ** `"onLeave"` => `0`
 * @param {boolean} [options.reverse=true] - Should the scene reverse, when scrolling up?
 * @param {number} [options.loglevel=2] - Loglevel for debugging. Note that logging is disabled in the minified version of ScrollMagic.
 										  ** `0` => silent
 										  ** `1` => errors
 										  ** `2` => errors, warnings
 										  ** `3` => errors, warnings, debuginfo
 * 
 */
export class Scene {
	/*
	* method used to add an option to ScrollMagic Scenes.
	* TODO: DOC (private for dev)
	*/
	static addOption(name, defaultValue, validationCallback, shifts) {
		if (!(name in SCENE_OPTIONS.defaults)) {
			SCENE_OPTIONS.defaults[name] = defaultValue;
			SCENE_OPTIONS.validate[name] = validationCallback;
			if (shifts) {
				SCENE_OPTIONS.shifts.push(name);
			}
		} else {
			Util.log(1, "[static] ScrollMagic.Scene -> Cannot add Scene option '" + name + "', because it already exists.");
		}
	};
	// instance extension function for plugins
	// TODO: DOC (private for dev)
	static extend(extension) {
		var oldClass = this;
		Scene = function () {
			oldClass.apply(this, arguments);
			this.$super = Util.extend({}, this); // copy parent state
			return extension.apply(this, arguments) || this;
		};
		Util.extend(Scene, oldClass); // copy properties
		Scene.prototype = oldClass.prototype; // copy prototype
		Scene.prototype.constructor = Scene; // restore constructor
	};

	constructor(options) {
		/*
		* ----------------------------------------------------------------
		* private vars
		* ----------------------------------------------------------------
		*/

		this._options = Util.extend({}, DEFAULT_OPTIONS, options);
		this._state = SCENE_STATE_BEFORE;
		this._progress = 0;
		this._scrollOffset = {start: 0, end: 0}; // reflects the controllers's scroll position for the start and end of the scene respectively
		this._triggerPos = 0;
		this._enabled = true;
		this._durationUpdateMethod = {};
		this._controller = {};
		this._listeners = {};

		for (var key in this._options) { // check supplied options
			if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
				this.log(2, "WARNING: Unknown option \"" + key + "\"");
				delete this._options[key];
			}
		}
		// add getters/setters for all possible options
		for (var optionName in DEFAULT_OPTIONS) {
			this.addSceneOption(optionName);
		}
		// validate all options
		this.validateOption();

		// set event listeners
		this
		.on("change.internal", (e)=>{
			if (e.what !== "loglevel" && e.what !== "tweenChanges") { // no need for a scene update scene with these options...
				if (e.what === "triggerElement") {
					this.updateTriggerElementPosition();
				} else if (e.what === "reverse") { // the only property left that may have an impact on the current scene state. Everything else is handled by the shift event.
					this.update();
				}
			}
		})
		.on("shift.internal",(e)=>{
			this.updateScrollOffset();
			this.update(); // update scene to reflect new position
		});

		this._cssClasses = [];
		this._cssClassElems = [];

		this
			.on("destroy.internal", (e)=>{
				this.removeClassToggle(e.reset);
			});

		
	this._pin = null;
	this._pinOptions = null;

	this
		.on("shift.internal", (e)=>{
			var durationChanged = e.reason === "duration";
			if ((this._state === SCENE_STATE_AFTER && durationChanged) || (this._state === SCENE_STATE_DURING && this._options.duration === 0)) {
				// if [duration changed after a scene (inside scene progress updates pin position)] or [duration is 0, we are in pin phase and some other value changed].
				this.updatePinState();
			}
			if (durationChanged) {
				this.updatePinDimensions();
			}
		})
		.on("progress.internal", (e)=>{
			this.updatePinState();
		})
		.on("add.internal", (e)=>{
			this.updatePinDimensions();
		})
		.on("destroy.internal", (e)=>{
			Scene.removePin(e.reset);
		});
	}

	// (BUILD) - REMOVE IN MINIFY - START
	/**
	 * Send a debug message to the console.
	 * @private
	 * but provided publicly with _log for plugins
	 *
	 * @param {number} loglevel - The loglevel required to initiate output for the message.
	 * @param {...mixed} output - One or more variables that should be passed to the console.
	 */
	log(loglevel, output) {
		if (this._options.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			Util.log.apply(window, arguments);
		}
	};
	// (BUILD) - REMOVE IN MINIFY - END

	/*
	* ----------------------------------------------------------------
	* Event Management
	* ----------------------------------------------------------------
	*/

	/**
	 * Scene start event.  
	 * Fires whenever the scroll position its the starting point of the scene.  
	 * It will also fire when scrolling back up going over the start position of the scene. If you want something to happen only when scrolling down/right, use the scrollDirection parameter passed to the callback.
	 *
	 * For details on this event and the order in which it is fired, please review the {@link Scene.progress} method.
	 *
	 * @event ScrollMagic.Scene#start
	 *
	 * @example
	 * scene.on("start", function (event) {
	 * 	console.log("Hit start point of scene.");
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {number} event.progress - Reflects the current progress of the scene
	 * @property {string} event.state - The current state of the scene `"BEFORE"` or `"DURING"`
	 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
	 */
	/**
	 * Scene end event.  
	 * Fires whenever the scroll position its the ending point of the scene.  
	 * It will also fire when scrolling back up from after the scene and going over its end position. If you want something to happen only when scrolling down/right, use the scrollDirection parameter passed to the callback.
	 *
	 * For details on this event and the order in which it is fired, please review the {@link Scene.progress} method.
	 *
	 * @event ScrollMagic.Scene#end
	 *
	 * @example
	 * scene.on("end", function (event) {
	 * 	console.log("Hit end point of scene.");
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {number} event.progress - Reflects the current progress of the scene
	 * @property {string} event.state - The current state of the scene `"DURING"` or `"AFTER"`
	 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
	 */
	/**
	 * Scene enter event.  
	 * Fires whenever the scene enters the "DURING" state.  
	 * Keep in mind that it doesn't matter if the scene plays forward or backward: This event always fires when the scene enters its active scroll timeframe, regardless of the scroll-direction.
	 *
	 * For details on this event and the order in which it is fired, please review the {@link Scene.progress} method.
	 *
	 * @event ScrollMagic.Scene#enter
	 *
	 * @example
	 * scene.on("enter", function (event) {
	 * 	console.log("Scene entered.");
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {number} event.progress - Reflects the current progress of the scene
	 * @property {string} event.state - The current state of the scene - always `"DURING"`
	 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
	 */
	/**
	 * Scene leave event.  
	 * Fires whenever the scene's state goes from "DURING" to either "BEFORE" or "AFTER".  
	 * Keep in mind that it doesn't matter if the scene plays forward or backward: This event always fires when the scene leaves its active scroll timeframe, regardless of the scroll-direction.
	 *
	 * For details on this event and the order in which it is fired, please review the {@link Scene.progress} method.
	 *
	 * @event ScrollMagic.Scene#leave
	 *
	 * @example
	 * scene.on("leave", function (event) {
	 * 	console.log("Scene left.");
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {number} event.progress - Reflects the current progress of the scene
	 * @property {string} event.state - The current state of the scene `"BEFORE"` or `"AFTER"`
	 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
	 */
	/**
	 * Scene update event.  
	 * Fires whenever the scene is updated (but not necessarily changes the progress).
	 *
	 * @event ScrollMagic.Scene#update
	 *
	 * @example
	 * scene.on("update", function (event) {
	 * 	console.log("Scene updated.");
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {number} event.startPos - The starting position of the scene (in relation to the conainer)
	 * @property {number} event.endPos - The ending position of the scene (in relation to the conainer)
	 * @property {number} event.scrollPos - The current scroll position of the container
	 */
	/**
	 * Scene progress event.  
	 * Fires whenever the progress of the scene changes.
	 *
	 * For details on this event and the order in which it is fired, please review the {@link Scene.progress} method.
	 *
	 * @event ScrollMagic.Scene#progress
	 *
	 * @example
	 * scene.on("progress", function (event) {
	 * 	console.log("Scene progress changed to " + event.progress);
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {number} event.progress - Reflects the current progress of the scene
	 * @property {string} event.state - The current state of the scene `"BEFORE"`, `"DURING"` or `"AFTER"`
	 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
	 */
	/**
	 * Scene change event.  
	 * Fires whenvever a property of the scene is changed.
	 *
	 * @event ScrollMagic.Scene#change
	 *
	 * @example
	 * scene.on("change", function (event) {
	 * 	console.log("Scene Property \"" + event.what + "\" changed to " + event.newval);
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {string} event.what - Indicates what value has been changed
	 * @property {mixed} event.newval - The new value of the changed property
	 */
	/**
	 * Scene shift event.  
	 * Fires whenvever the start or end **scroll offset** of the scene change.
	 * This happens explicitely, when one of these values change: `offset`, `duration` or `triggerHook`.
	 * It will fire implicitly when the `triggerElement` changes, if the new element has a different position (most cases).
	 * It will also fire implicitly when the size of the container changes and the triggerHook is anything other than `onLeave`.
	 *
	 * @event ScrollMagic.Scene#shift
	 * @since 1.1.0
	 *
	 * @example
	 * scene.on("shift", function (event) {
	 * 	console.log("Scene moved, because the " + event.reason + " has changed.)");
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {string} event.reason - Indicates why the scene has shifted
	 */
	/**
	 * Scene destroy event.  
	 * Fires whenvever the scene is destroyed.
	 * This can be used to tidy up custom behaviour used in events.
	 *
	 * @event ScrollMagic.Scene#destroy
	 * @since 1.1.0
	 *
	 * @example
	 * scene.on("enter", function (event) {
	 *        // add custom action
	 *        $("#my-elem").left("200");
	 *      })
	 *      .on("destroy", function (event) {
	 *        // reset my element to start position
	 *        if (event.reset) {
	 *          $("#my-elem").left("0");
	 *        }
	 *      });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {boolean} event.reset - Indicates if the destroy method was called with reset `true` or `false`.
	 */
	/**
	 * Scene add event.  
	 * Fires when the scene is added to a controller.
	 * This is mostly used by plugins to know that change might be due.
	 *
	 * @event ScrollMagic.Scene#add
	 * @since 2.0.0
	 *
	 * @example
	 * scene.on("add", function (event) {
	 * 	console.log('Scene was added to a new controller.');
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 * @property {boolean} event.controller - The controller object the scene was added to.
	 */
	/**
	 * Scene remove event.  
	 * Fires when the scene is removed from a controller.
	 * This is mostly used by plugins to know that change might be due.
	 *
	 * @event ScrollMagic.Scene#remove
	 * @since 2.0.0
	 *
	 * @example
	 * scene.on("remove", function (event) {
	 * 	console.log('Scene was removed from its controller.');
	 * });
	 *
	 * @property {object} event - The event Object passed to each callback
	 * @property {string} event.type - The name of the event
	 * @property {Scene} event.target - The Scene object that triggered this event
	 */

	/**
	 * Add one ore more event listener.  
	 * The callback function will be fired at the respective event, and an object containing relevant data will be passed to the callback.
	 * @method ScrollMagic.Scene#on
	 *
	 * @example
	 * function callback (event) {
	 * 		console.log("Event fired! (" + event.type + ")");
	 * }
	 * // add listeners
	 * scene.on("change update progress start end enter leave", callback);
	 *
	 * @param {string} names - The name or names of the event the callback should be attached to.
	 * @param {function} callback - A function that should be executed, when the event is dispatched. An event object will be passed to the callback.
	 * @returns {Scene} Parent object for chaining.
	 */
	on(names, callback) {
		if (Type.Function(callback)) {
			names = names.trim().split(' ');
			names.forEach(function (fullname) {
				var
					nameparts = fullname.split('.'),
					eventname = nameparts[0],
					namespace = nameparts[1];
				if (eventname !== "*") { // disallow wildcards
					if (!this._listeners[eventname]) {
						this._listeners[eventname] = [];
					}
					this._listeners[eventname].push({
						namespace: namespace || '',
						callback: callback
					});
				}
			});
		} else {
			this.log(1, "ERROR when calling '.on()': Supplied callback for '" + names + "' is not a valid function!");
		}
		return this;
	};

	/**
	 * Remove one or more event listener.
	 * @method ScrollMagic.Scene#off
	 *
	 * @example
	 * function callback (event) {
	 * 		console.log("Event fired! (" + event.type + ")");
	 * }
	 * // add listeners
	 * scene.on("change update", callback);
	 * // remove listeners
	 * scene.off("change update", callback);
	 *
	 * @param {string} names - The name or names of the event that should be removed.
	 * @param {function} [callback] - A specific callback function that should be removed. If none is passed all callbacks to the event listener will be removed.
	 * @returns {Scene} Parent object for chaining.
	*/
	off(names, callback) {
		if (!names) {
			this.log(1, "ERROR: Invalid event name supplied.");
			return this;
		}
		names = names.trim().split(' ');
		names.forEach(function (fullname, key) {
			var
				nameparts = fullname.split('.'),
				eventname = nameparts[0],
				namespace = nameparts[1] || '',
				removeList = eventname === '*' ? Object.keys(this._listeners) : [eventname];
			removeList.forEach(function (remove){
				var
					list = this._listeners[remove] || [],
					i = list.length;
				while(i--) {
					var listener = list[i];
					if (listener && (namespace === listener.namespace || namespace === '*') && (!callback || callback === listener.callback)) {
						list.splice(i, 1);
					}
				}
				if (!list.length) {
					delete this._listeners[remove];
				}
			});
		});
		return this;
	};

	/**
	 * Trigger an event.
	 * @method ScrollMagic.Scene#trigger
	 *
	 * @example
	 * this.trigger("change");
	 *
	 * @param {string} name - The name of the event that should be triggered.
	 * @param {object} [vars] - An object containing info that should be passed to the callback.
	 * @returns {Scene} Parent object for chaining.
	*/
	trigger(name, vars) {
		if (name) {
			var
				nameparts = name.trim().split('.'),
				eventname = nameparts[0],
				namespace = nameparts[1],
				listeners = this._listeners[eventname];
			this.log(3, 'event fired:', eventname, vars ? "->" : '', vars || '');
			if (listeners) {
				listeners.forEach(function (listener, key) {
					if (!namespace || namespace === listener.namespace) {
						listener.callback.call(this, new Event(eventname, listener.namespace, this, vars));
					}
				});
			}
		} else {
			this.log(1, "ERROR: Invalid event name supplied.");
		}
		return this;
	};

	/**
	 * Add the scene to a controller.  
	 * This is the equivalent to `Controller.addScene(scene)`.
	 * @method ScrollMagic.Scene#addTo
	 *
	 * @example
	 * // add a scene to a ScrollMagic Controller
	 * scene.addTo(controller);
	 *
	 * @param {ScrollMagic.Controller} controller - The controller to which the scene should be added.
	 * @returns {Scene} Parent object for chaining.
	 */
	addTo(controller) {
		if (!(controller instanceof Controller)) {
			this.log(1, "ERROR: supplied argument of 'addTo()' is not a valid ScrollMagic Controller");
		} else if (this._controller !== controller) {
			// new controller
			if (this._controller) { // was associated to a different controller before, so remove it...
				this._controller.removeScene(Scene);
			}
			this._controller = controller;
			this.validateOption();
			this.updateDuration(true);
			this.updateTriggerElementPosition(true);
			this.updateScrollOffset();
			this._controller.info("container").addEventListener('resize', this.onContainerResize.bind(this));
			controller.addScene(Scene);
			Scene.trigger("add", {controller: this._controller});
			this.log(3, "added " + NAMESPACE + " to controller");
			Scene.update();
		}
		return this;
	};

	/**
	 * **Get** or **Set** the current enabled state of the scene.  
	 * This can be used to disable this scene without removing or destroying it.
	 * @method ScrollMagic.Scene#enabled
	 *
	 * @example
	 * // get the current value
	 * var enabled = scene.enabled();
	 *
		 * // disable the scene
	 * scene.enabled(false);
	 *
	 * @param {boolean} [newState] - The new enabled state of the scene `true` or `false`.
	 * @returns {(boolean|Scene)} Current enabled state or parent object for chaining.
	 */
	enabled(newState) {
		if (!arguments.length) { // get
			return this._enabled;
		} else if (this._enabled !== newState) { // set
			this._enabled = !!newState;
			Scene.update(true);
		}
		return this;
	};

	/**
	 * Remove the scene from the controller.  
	 * This is the equivalent to `Controller.removeScene(scene)`.
	 * The scene will not be updated anymore until you readd it to a controller.
	 * To remove the pin or the tween you need to call removeTween() or removePin() respectively.
	 * @method ScrollMagic.Scene#remove
	 * @example
	 * // remove the scene from its controller
	 * scene.remove();
	 *
	 * @returns {Scene} Parent object for chaining.
	 */
	remove() {
		if (this._controller) {
			this._controller.info("container").removeEventListener('resize', this.onContainerResize.bind(this));
			var tmpParent = this._controller;
			this._controller = undefined;
			tmpParent.removeScene(Scene);
			Scene.trigger("remove");
			this.log(3, "removed " + NAMESPACE + " from controller");
		}
		return this;
	};

	/**
	 * Destroy the scene and everything.
	 * @method ScrollMagic.Scene#destroy
	 * @example
	 * // destroy the scene without resetting the pin and tween to their initial positions
	 * scene = scene.destroy();
	 *
	 * // destroy the scene and reset the pin and tween
	 * scene = scene.destroy(true);
	 *
	 * @param {boolean} [reset=false] - If `true` the pin and tween (if existent) will be reset.
	 * @returns {null} Null to unset handler variables.
	 */
	destroy(reset) {
		Scene.trigger("destroy", {reset: reset});
		Scene.remove();
		Scene.off("*.*");
		this.log(3, "destroyed " + NAMESPACE + " (reset: " + (reset ? "true" : "false") + ")");
		return null;
	};


	/**
	 * Updates the Scene to reflect the current state.  
	 * This is the equivalent to `Controller.updateScene(scene, immediately)`.  
	 * The update method calculates the scene's start and end position (based on the trigger element, trigger hook, duration and offset) and checks it against the current scroll position of the container.  
	 * It then updates the current scene state accordingly (or does nothing, if the state is already correct) – Pins will be set to their correct position and tweens will be updated to their correct progress.
	 * This means an update doesn't necessarily result in a progress change. The `progress` event will be fired if the progress has indeed changed between this update and the last.  
	 * _**NOTE:** This method gets called constantly whenever ScrollMagic detects a change. The only application for you is if you change something outside of the realm of ScrollMagic, like moving the trigger or changing tween parameters._
	 * @method ScrollMagic.Scene#update
	 * @example
	 * // update the scene on next tick
	 * scene.update();
	 *
	 * // update the scene immediately
	 * scene.update(true);
	 *
	 * @fires Scene.update
	 *
	 * @param {boolean} [immediately=false] - If `true` the update will be instant, if `false` it will wait until next update cycle (better performance).
	 * @returns {Scene} Parent object for chaining.
	 */
	update(immediately) {
		if (this._controller) {
			if (immediately) {
				if (this._controller.enabled() && this._enabled) {
					var
						scrollPos = this._controller.info("scrollPos"),
						newProgress;

					if (this._options.duration > 0) {
						newProgress = (scrollPos - this._scrollOffset.start)/(this._scrollOffset.end - this._scrollOffset.start);
					} else {
						newProgress = scrollPos >= this._scrollOffset.start ? 1 : 0;
					}

					Scene.trigger("update", {startPos: this._scrollOffset.start, endPos: this._scrollOffset.end, scrollPos: scrollPos});

					Scene.progress(newProgress);
				} else if (this._pin && this._state === SCENE_STATE_DURING) {
					this.updatePinState(true); // unpin in position
				}
			} else {
				this._controller.updateScene(Scene, false);
			}
		}
		return this;
	};

	/**
	 * Updates dynamic scene variables like the trigger element position or the duration.
	 * This method is automatically called in regular intervals from the controller. See {@link ScrollMagic.Controller} option `refreshInterval`.
	 * 
	 * You can call it to minimize lag, for example when you intentionally change the position of the triggerElement.
	 * If you don't it will simply be updated in the next refresh interval of the container, which is usually sufficient.
	 *
	 * @method ScrollMagic.Scene#refresh
	 * @since 1.1.0
	 * @example
	 * scene = new ScrollMagic.Scene({triggerElement: "#trigger"});
	 * 
	 * // change the position of the trigger
	 * $("#trigger").css("top", 500);
	 * // immediately let the scene know of this change
	 * scene.refresh();
	 *
	 * @fires {@link Scene.shift}, if the trigger element position or the duration changed
	 * @fires {@link Scene.change}, if the duration changed
	 *
	 * @returns {Scene} Parent object for chaining.
	 */
	refresh() {
		this.updateDuration();
		this.updateTriggerElementPosition();
		// update trigger element position
		return this;
	};


	/**
	 * **Get** or **Set** the scene's progress.  
	 * Usually it shouldn't be necessary to use this as a setter, as it is set automatically by scene.update().  
	 * The order in which the events are fired depends on the duration of the scene:
	 *  1. Scenes with `duration == 0`:  
	 *  Scenes that have no duration by definition have no ending. Thus the `end` event will never be fired.  
	 *  When the trigger position of the scene is passed the events are always fired in this order:  
	 *  `enter`, `start`, `progress` when scrolling forward  
	 *  and  
	 *  `progress`, `start`, `leave` when scrolling in reverse
	 *  2. Scenes with `duration > 0`:  
	 *  Scenes with a set duration have a defined start and end point.  
	 *  When scrolling past the start position of the scene it will fire these events in this order:  
	 *  `enter`, `start`, `progress`  
	 *  When continuing to scroll and passing the end point it will fire these events:  
	 *  `progress`, `end`, `leave`  
	 *  When reversing through the end point these events are fired:  
	 *  `enter`, `end`, `progress`  
	 *  And when continuing to scroll past the start position in reverse it will fire:  
	 *  `progress`, `start`, `leave`  
	 *  In between start and end the `progress` event will be called constantly, whenever the progress changes.
	 * 
	 * In short:  
	 * `enter` events will always trigger **before** the progress update and `leave` envents will trigger **after** the progress update.  
	 * `start` and `end` will always trigger at their respective position.
	 * 
	 * Please review the event descriptions for details on the events and the event object that is passed to the callback.
	 * 
	 * @method ScrollMagic.Scene#progress
	 * @example
	 * // get the current scene progress
	 * var progress = scene.progress();
	 *
		 * // set new scene progress
	 * scene.progress(0.3);
	 *
	 * @fires {@link Scene.enter}, when used as setter
	 * @fires {@link Scene.start}, when used as setter
	 * @fires {@link Scene.progress}, when used as setter
	 * @fires {@link Scene.end}, when used as setter
	 * @fires {@link Scene.leave}, when used as setter
	 *
	 * @param {number} [progress] - The new progress value of the scene `[0-1]`.
	 * @returns {number} `get` -  Current scene progress.
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */
	progress(progress) {
		if (!arguments.length) { // get
			return this._progress;
		} else { // set
			var
				doUpdate = false,
				oldState = this._state,
				scrollDirection = this._controller ? this._controller.info("scrollDirection") : 'PAUSED',
				reverseOrForward = this._options.reverse || progress >= this._progress;
			if (this._options.duration === 0) {
				// zero duration scenes
				doUpdate = this._progress !== progress;
				this._progress = progress < 1 && reverseOrForward ? 0 : 1;
				this._state = this._progress === 0 ? SCENE_STATE_BEFORE : SCENE_STATE_DURING;
			} else {
				// scenes with start and end
				if (progress < 0 && this._state !== SCENE_STATE_BEFORE && reverseOrForward) {
					// go back to initial state
					this._progress = 0;
					this._state = SCENE_STATE_BEFORE;
					doUpdate = true;
				} else if (progress >= 0 && progress < 1 && reverseOrForward) {
					this._progress = progress;
					this._state = SCENE_STATE_DURING;
					doUpdate = true;
				} else if (progress >= 1 && this._state !== SCENE_STATE_AFTER) {
					this._progress = 1;
					this._state = SCENE_STATE_AFTER;
					doUpdate = true;
				} else if (this._state === SCENE_STATE_DURING && !reverseOrForward) {
					this.updatePinState(); // in case we scrolled backwards mid-scene and reverse is disabled => update the pin position, so it doesn't move back as well.
				}
			}
			if (doUpdate) {
				// fire events
				var
					eventVars = {progress: this._progress, state: this._state, scrollDirection: scrollDirection},
					stateChanged = this._state !== oldState;

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
					if (this._state !== SCENE_STATE_DURING) {
						trigger(this._state === SCENE_STATE_BEFORE ? "start" : "end");
						trigger("leave");
					}
				}
			}

			return this;
		}
	};

	/**
	 * Define a css class modification while the scene is active.  
	 * When the scene triggers the classes will be added to the supplied element and removed, when the scene is over.
	 * If the scene duration is 0 the classes will only be removed if the user scrolls back past the start position.
	 * @method ScrollMagic.Scene#setClassToggle
	 * @example
	 * // add the class 'myclass' to the element with the id 'my-elem' for the duration of the scene
	 * scene.setClassToggle("#my-elem", "myclass");
	 *
	 * // add multiple classes to multiple elements defined by the selector '.classChange'
	 * scene.setClassToggle(".classChange", "class1 class2 class3");
	 *
	 * @param {(string|object)} element - A Selector targeting one or more elements or a DOM object that is supposed to be modified.
	 * @param {string} classes - One or more Classnames (separated by space) that should be added to the element during the scene.
	 *
	 * @returns {Scene} Parent object for chaining.
	 */
	setClassToggle(element, classes) {
		var elems = Get.elements(element);
		if (elems.length === 0 || !Type.String(classes)) {
			this.log(1, "ERROR calling method 'setClassToggle()': Invalid " + (elems.length === 0 ? "element" : "classes") + " supplied.");
			return this;
		}
		if (this._cssClassElems.length > 0) {
			// remove old ones
			this.removeClassToggle();
		}
		this._cssClasses = classes;
		this._cssClassElems = elems;
		this.on("enter.internal_class leave.internal_class", (e)=>{
			var toggle = e.type === "enter" ? Util.addClass : Util.removeClass;
			this._cssClassElems.forEach(function (elem, key) {
				toggle(elem, this._cssClasses);
			});
		});
		return this;
	};

	/**
	 * Remove the class binding from the scene.
	 * @method ScrollMagic.Scene#removeClassToggle
	 * @example
	 * // remove class binding from the scene without reset
	 * scene.removeClassToggle();
	 *
	 * // remove class binding and remove the changes it caused
	 * scene.removeClassToggle(true);
	 *
	 * @param {boolean} [reset=false] - If `false` and the classes are currently active, they will remain on the element. If `true` they will be removed.
	 * @returns {Scene} Parent object for chaining.
	 */
	removeClassToggle(reset) {
		if (reset) {
			this._cssClassElems.forEach(function (elem, key) {
				Util.removeClass(elem, this._cssClasses);
			});
		}
		Scene.off("start.internal_class end.internal_class");
		this._cssClasses = undefined;
		this._cssClassElems = [];
		return this;
	};

	/**
	 * Update the pin state.
	 * @private
	 */
	updatePinState(forceUnpin) {
		if (this._pin && this._controller) {
			var 
				containerInfo = this._controller.info(),
				pinTarget = this._pinOptions.spacer.firstChild; // may be pin element or another spacer, if cascading pins

			if (!forceUnpin && this._state === SCENE_STATE_DURING) { // during scene or if duration is 0 and we are past the trigger
				// pinned state
				if (Util.css(pinTarget, "position") !== "fixed") {
					// change state before updating pin spacer (position changes due to fixed collapsing might occur.)
					Util.css(pinTarget, {"position": "fixed"});
					// update pin spacer
					this.updatePinDimensions();
				}

				var
					fixedPos = Get.offset(this._pinOptions.spacer, true), // get viewport position of spacer
					scrollDistance = this._options.reverse || this._options.duration === 0 ?
										containerInfo.scrollPos - this._scrollOffset.start // quicker
									: Math.round(this._progress * this._options.duration * 10)/10; // if no reverse and during pin the position needs to be recalculated using the progress
				
				// add scrollDistance
				fixedPos[containerInfo.vertical ? "top" : "left"] += scrollDistance;

				// set new values
				Util.css(this._pinOptions.spacer.firstChild, {
					top: fixedPos.top,
					left: fixedPos.left
				});
			} else {
				// unpinned state
				var
					newCSS = {
						position: this._pinOptions.inFlow ? "relative" : "absolute",
						top:  0,
						left: 0
					},
					change = Util.css(pinTarget, "position") !== newCSS.position;
				
				if (!this._pinOptions.pushFollowers) {
					newCSS[containerInfo.vertical ? "top" : "left"] = this._options.duration * this._progress;
				} else if (this._options.duration > 0) { // only concerns scenes with duration
					if (this._state === SCENE_STATE_AFTER && parseFloat(Util.css(this._pinOptions.spacer, "padding-top")) === 0) {
						change = true; // if in after state but havent updated spacer yet (jumped past pin)
					} else if (this._state === SCENE_STATE_BEFORE && parseFloat(Util.css(this._pinOptions.spacer, "padding-bottom")) === 0) { // before
						change = true; // jumped past fixed state upward direction
					}
				}
				// set new values
				Util.css(pinTarget, newCSS);
				if (change) {
					// update pin spacer if state changed
					this.updatePinDimensions();
				}
			}
		}
	};

	/**
	 * Update the pin spacer and/or element size.
	 * The size of the spacer needs to be updated whenever the duration of the scene changes, if it is to push down following elements.
	 * @private
	 */
	updatePinDimensions() {
		if (this._pin && this._controller && this._pinOptions.inFlow) { // no spacerresize, if original position is absolute
			var
				after = (this._state === SCENE_STATE_AFTER),
				before = (this._state === SCENE_STATE_BEFORE),
				during = (this._state === SCENE_STATE_DURING),
				vertical = this._controller.info("vertical"),
				pinTarget = this._pinOptions.spacer.firstChild, // usually the pined element but can also be another spacer (cascaded pins)
				marginCollapse = Util.isMarginCollapseType(Util.css(this._pinOptions.spacer, "display")),
				css = {};

			// set new size
			// if relsize: spacer -> pin | else: pin -> spacer
			if (this._pinOptions.relSize.width || this._pinOptions.relSize.autoFullWidth) {
				if (during) {
					Util.css(this._pin, {"width": Get.width(this._pinOptions.spacer)});
				} else {
					Util.css(this._pin, {"width": "100%"});
				}
			} else {
				// minwidth is needed for cascaded pins.
				css["min-width"] = Get.width(vertical ? this._pin : pinTarget, true, true);
				css.width = during ? css["min-width"] : "auto";
			}
			if (this._pinOptions.relSize.height) {
				if (during) {
					// the only padding the spacer should ever include is the duration (if pushFollowers = true), so we need to substract that.
					Util.css(this._pin, {"height": Get.height(this._pinOptions.spacer) - (this._pinOptions.pushFollowers ? this._options.duration : 0)});
				} else {
					Util.css(this._pin, {"height": "100%"});
				}
			} else {
				// margin is only included if it's a cascaded pin to resolve an IE9 bug
				css["min-height"] = Get.height(vertical ? pinTarget : this._pin, true , !marginCollapse); // needed for cascading pins
				css.height = during ? css["min-height"] : "auto";
			}

			// add space for duration if pushFollowers is true
			if (this._pinOptions.pushFollowers) {
				css["padding" + (vertical ? "Top" : "Left")] = this._options.duration * this._progress;
				css["padding" + (vertical ? "Bottom" : "Right")] = this._options.duration * (1 - this._progress);
			}
			Util.css(this._pinOptions.spacer, css);
		}
	};

	/**
	 * Updates the Pin state (in certain scenarios)
	 * If the controller container is not the document and we are mid-pin-phase scrolling or resizing the main document can result to wrong pin positions.
	 * So this function is called on resize and scroll of the document.
	 * @private
	 */
	updatePinInContainer() {
		if (this._controller && this._pin && this._state === SCENE_STATE_DURING && !this._controller.info("isDocument")) {
			this.updatePinState();
		}
	};

	/**
	 * Updates the Pin spacer size state (in certain scenarios)
	 * If container is resized during pin and relatively sized the size of the pin might need to be updated...
	 * So this function is called on resize of the container.
	 * @private
	 */
	updateRelativePinSpacer() {
		if ( this._controller && this._pin && // well, duh
			this._state === SCENE_STATE_DURING && // element in pinned state?
				( // is width or height relatively sized, but not in relation to body? then we need to recalc.
					((this._pinOptions.relSize.width || this._pinOptions.relSize.autoFullWidth) && Get.width(window) !== Get.width(this._pinOptions.spacer.parentNode)) ||
					(this._pinOptions.relSize.height && Get.height(window) !== Get.height(this._pinOptions.spacer.parentNode))
				)
		) {
			this.updatePinDimensions();
		}
	};

	/**
	 * Is called, when the mousewhel is used while over a pinned element inside a div container.
	 * If the scene is in fixed state scroll events would be counted towards the body. This forwards the event to the scroll container.
	 * @private
	 */
	onMousewheelOverPin(e) {
		if (this._controller && this._pin && this._state === SCENE_STATE_DURING && !this._controller.info("isDocument")) { // in pin state
			e.preventDefault();
			this._controller._setScrollPos(this._controller.info("scrollPos") - ((e.wheelDelta || e[this._controller.info("vertical") ? "wheelDeltaY" : "wheelDeltaX"])/3 || -e.detail*30));
		}
	};

	/**
	 * Pin an element for the duration of the scene.
	 * If the scene duration is 0 the element will only be unpinned, if the user scrolls back past the start position.  
	 * Make sure only one pin is applied to an element at the same time.
	 * An element can be pinned multiple times, but only successively.
	 * _**NOTE:** The option `pushFollowers` has no effect, when the scene duration is 0._
	 * @method ScrollMagic.Scene#setPin
	 * @example
	 * // pin element and push all following elements down by the amount of the pin duration.
	 * scene.setPin("#pin");
	 *
	 * // pin element and keeping all following elements in their place. The pinned element will move past them.
	 * scene.setPin("#pin", {pushFollowers: false});
	 *
	 * @param {(string|object)} element - A Selector targeting an element or a DOM object that is supposed to be pinned.
	 * @param {object} [settings] - settings for the pin
	 * @param {boolean} [settings.pushFollowers=true] - If `true` following elements will be "pushed" down for the duration of the pin, if `false` the pinned element will just scroll past them.  
														Ignored, when duration is `0`.
	* @param {string} [settings.spacerClass="scrollmagic-pin-spacer"] - Classname of the pin spacer element, which is used to replace the element.
	*
	* @returns {Scene} Parent object for chaining.
	*/
	setPin(element, settings) {
		var
			defaultSettings = {
				pushFollowers: true,
				spacerClass: "scrollmagic-pin-spacer"
			};
		// (BUILD) - REMOVE IN MINIFY - START
		var pushFollowersActivelySet = settings && settings.hasOwnProperty('pushFollowers');
		// (BUILD) - REMOVE IN MINIFY - END
		settings = Util.extend({}, defaultSettings, settings);

		// validate Element
		element = Get.elements(element)[0];
		if (!element) {
			this.log(1, "ERROR calling method 'setPin()': Invalid pin element supplied.");
			return this; // cancel
		} else if (Util.css(element, "position") === "fixed") {
			this.log(1, "ERROR calling method 'setPin()': Pin does not work with elements that are positioned 'fixed'.");
			return this; // cancel
		}

		if (this._pin) { // preexisting pin?
			if (this._pin === element) {
				// same pin we already have -> do nothing
				return this; // cancel
			} else {
				// kill old pin
				this.removePin();
			}
			
		}
		this._pin = element;
		
		var
			parentDisplay = this._pin.parentNode.style.display,
			boundsParams = ["top", "left", "bottom", "right", "margin", "marginLeft", "marginRight", "marginTop", "marginBottom"];

			this._pin.parentNode.style.display = 'none'; // hack start to force css to return stylesheet values instead of calculated px values.
		var
			inFlow = Util.css(this._pin, "position") !== "absolute",
			pinCSS = Util.css(this._pin, boundsParams.concat(["display"])),
			sizeCSS = Util.css(this._pin, ["width", "height"]);
			this._pin.parentNode.style.display = parentDisplay; // hack end.

		if (!inFlow && settings.pushFollowers) {
			this.log(2, "WARNING: If the pinned element is positioned absolutely pushFollowers will be disabled.");
			settings.pushFollowers = false;
		}
		// (BUILD) - REMOVE IN MINIFY - START
		window.setTimeout(function () { // wait until all finished, because with responsive duration it will only be set after scene is added to controller
			if (this._pin && this._options.duration === 0 && pushFollowersActivelySet && settings.pushFollowers) {
				this.log(2, "WARNING: pushFollowers =", true, "has no effect, when scene duration is 0.");
			}
		}, 0);
		// (BUILD) - REMOVE IN MINIFY - END

		// create spacer and insert
		var
			spacer = this._pin.parentNode.insertBefore(document.createElement('div'), this._pin),
			spacerCSS = Util.extend(pinCSS, {
					position: inFlow ? "relative" : "absolute",
					boxSizing: "content-box",
					mozBoxSizing: "content-box",
					webkitBoxSizing: "content-box"
				});

		if (!inFlow) { // copy size if positioned absolutely, to work for bottom/right positioned elements.
			Util.extend(spacerCSS, Util.css(this._pin, ["width", "height"]));
		}

		Util.css(spacer, spacerCSS);
		spacer.setAttribute(PIN_SPACER_ATTRIBUTE, "");
		Util.addClass(spacer, settings.spacerClass);

		// set the pin Options
		this._pinOptions = {
			spacer: spacer,
			relSize: { // save if size is defined using % values. if so, handle spacer resize differently...
				width: sizeCSS.width.slice(-1) === "%",
				height: sizeCSS.height.slice(-1) === "%",
				autoFullWidth: sizeCSS.width === "auto" && inFlow && Util.isMarginCollapseType(pinCSS.display)
			},
			pushFollowers: settings.pushFollowers,
			inFlow: inFlow, // stores if the element takes up space in the document flow
		};
		
		if (!this._pin.___origStyle) {
			this._pin.___origStyle = {};
			var
				pinInlineCSS = this._pin.style,
				copyStyles = boundsParams.concat(["width", "height", "position", "boxSizing", "mozBoxSizing", "webkitBoxSizing"]);
			copyStyles.forEach(function (val) {
				this._pin.___origStyle[val] = pinInlineCSS[val] || "";
			});
		}

		// if relative size, transfer it to spacer and make pin calculate it...
		if (this._pinOptions.relSize.width) {
			Util.css(spacer, {width: sizeCSS.width});
		}
		if (this._pinOptions.relSize.height) {
			Util.css(spacer, {height: sizeCSS.height});
		}

		// now place the pin element inside the spacer	
		spacer.appendChild(this._pin);
		// and set new css
		Util.css(this._pin, {
			position: inFlow ? "relative" : "absolute",
			margin: "auto",
			top: "auto",
			left: "auto",
			bottom: "auto",
			right: "auto"
		});
		
		if (this._pinOptions.relSize.width || this._pinOptions.relSize.autoFullWidth) {
			Util.css(this._pin, {
				boxSizing : "border-box",
				mozBoxSizing : "border-box",
				webkitBoxSizing : "border-box"
			});
		}

		// add listener to document to update pin position in case controller is not the document.
		window.addEventListener('scroll', this.updatePinInContainer);
		window.addEventListener('resize', this.updatePinInContainer);
		window.addEventListener('resize', this.updateRelativePinSpacer);
		// add mousewheel listener to catch scrolls over fixed elements
		this._pin.addEventListener("mousewheel", this.onMousewheelOverPin);
		this._pin.addEventListener("DOMMouseScroll", this.onMousewheelOverPin);

		this.log(3, "added pin");

		// finally update the pin to init
		this.updatePinState();

		return this;
	};

	/**
	 * Remove the pin from the scene.
	 * @method ScrollMagic.Scene#removePin
	 * @example
	 * // remove the pin from the scene without resetting it (the spacer is not removed)
	 * scene.removePin();
	 *
	 * // remove the pin from the scene and reset the pin element to its initial position (spacer is removed)
	 * scene.removePin(true);
	 *
	 * @param {boolean} [reset=false] - If `false` the spacer will not be removed and the element's position will not be reset.
	 * @returns {Scene} Parent object for chaining.
	 */
	removePin(reset) {
		if (this._pin) {
			if (this._state === SCENE_STATE_DURING) {
				this.updatePinState(true); // force unpin at position
			}
			if (reset || !this._controller) { // if there's no controller no progress was made anyway...
				var pinTarget = this._pinOptions.spacer.firstChild; // usually the pin element, but may be another spacer (cascaded pins)...
				if (pinTarget.hasAttribute(PIN_SPACER_ATTRIBUTE)) { // copy margins to child spacer
					var
						style = this._pinOptions.spacer.style,
						values = ["margin", "marginLeft", "marginRight", "marginTop", "marginBottom"],
						margins = {};
					values.forEach(function (val) {
						margins[val] = style[val] || "";
					});
					Util.css(pinTarget, margins);
				}
				this._pinOptions.spacer.parentNode.insertBefore(pinTarget, this._pinOptions.spacer);
				this._pinOptions.spacer.parentNode.removeChild(this._pinOptions.spacer);
				if (!this._pin.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) { // if it's the last pin for this element -> restore inline styles
					// TODO: only correctly set for first pin (when cascading) - how to fix?
					Util.css(this._pin, this._pin.___origStyle);
					delete this._pin.___origStyle;
				}
			}
			window.removeEventListener('scroll', this.updatePinInContainer.bind(this));
			window.removeEventListener('resize', this.updatePinInContainer.bind(this));
			window.removeEventListener('resize', this.updateRelativePinSpacer.bind(this));
			this._pin.removeEventListener("mousewheel", this.onMousewheelOverPin.bind(this));
			this._pin.removeEventListener("DOMMouseScroll", this.onMousewheelOverPin.bind(this));
			this._pin = undefined;
			this.log(3, "removed pin (reset: " + (reset ? "true" : "false") + ")");
		}
		return this;
	};

	_validate = Util.extend(SCENE_OPTIONS.validate, {
		// validation for duration handled internally for reference to private var _durationMethod
		duration : function (val) {
			if (Type.String(val) && val.match(/^(\.|\d)*\d+%$/)) {
				// percentage value
				var perc = parseFloat(val) / 100;
				val = function () {
					return this._controller ? this._controller.info("size") * perc : 0;
				};
			}
			if (Type.Function(val)) {
				// function
				this._durationUpdateMethod = val;
				try {
					val = parseFloat(this._durationUpdateMethod.call(Scene));
				} catch (e) {
					val = -1; // will cause error below
				}
			}
			// val has to be float
			val = parseFloat(val);
			if (!Type.Number(val) || val < 0) {
				if (this._durationUpdateMethod) {
					this._durationUpdateMethod = undefined;
					throw new Error(["Invalid return value of supplied function for option \"duration\":", val]);
				} else {
					throw new Error(["Invalid value for option \"duration\":", val]);
				}
			}
			return val;
		}
	});

	/**
	 * Checks the validity of a specific or all options and reset to default if neccessary.
	 * @private
	 */
	validateOption(check) {
		check = arguments.length ? [check] : Object.keys(this._validate);
		check.forEach(function (optionName, key) {
			var value;
			if (this._validate[optionName]) { // there is a validation method for this option
				try { // validate value
					value = this._validate[optionName](this._options[optionName]);
				} catch (e) { // validation failed -> reset to default
					value = DEFAULT_OPTIONS[optionName];
					// (BUILD) - REMOVE IN MINIFY - START
					var logMSG = Type.String(e) ? [e] : e;
					if (Type.Array(logMSG)) {
						logMSG[0] = "ERROR: " + logMSG[0];
						logMSG.unshift(1); // loglevel 1 for error msg
						this.log.apply(this, logMSG);
					} else {
						this.log(1, "ERROR: Problem executing validation callback for option '" + optionName + "':", e.message);
					}
					// (BUILD) - REMOVE IN MINIFY - END
				} finally {
					this._options[optionName] = value;
				}
			}
		});
	};

	/**
	 * Helper used by the setter/getters for scene options
	 * @private
	 */
 	changeOption = function(varname, newval) {
		var
			changed = false,
			oldval = this._options[varname];
		if (this._options[varname] !== newval) {
			this._options[varname] = newval;
			this.validateOption(varname); // resets to default if necessary
			changed = oldval !== this._options[varname];
		}
		return changed;
	};

	// generate getters/setters for all options
	addSceneOption(optionName) {
		if (!this[optionName]) {
			this[optionName] = function (newVal) {
				if (!arguments.length) { // get
					return this._options[optionName];
				} else {
					if (optionName === "duration") { // new duration is set, so any previously set function must be unset
						this._durationUpdateMethod = undefined;
					}
					if (this.changeOption(optionName, newVal)) { // set
						this.trigger("change", {what: optionName, newval: this._options[optionName]});
						if (SCENE_OPTIONS.shifts.indexOf(optionName) > -1) {
							this.trigger("shift", {reason: optionName});
						}
					}
				}
				return this;
			};
		}
	};

	/**
	 * **Get** or **Set** the duration option value.
	 *
	 * As a **setter** it accepts three types of parameters:
	 * 1. `number`: Sets the duration of the scene to exactly this amount of pixels.  
	 *   This means the scene will last for exactly this amount of pixels scrolled. Sub-Pixels are also valid.
	 *   A value of `0` means that the scene is 'open end' and no end will be triggered. Pins will never unpin and animations will play independently of scroll progress.
	 * 2. `string`: Always updates the duration relative to parent scroll container.  
	 *   For example `"100%"` will keep the duration always exactly at the inner height of the scroll container.
	 *   When scrolling vertically the width is used for reference respectively.
	 * 3. `function`: The supplied function will be called to return the scene duration.
	 *   This is useful in setups where the duration depends on other elements who might change size. By supplying a function you can return a value instead of updating potentially multiple scene durations.  
	 *   The scene can be referenced inside the callback using `this`.
	 *   _**WARNING:** This is an easy way to kill performance, as the callback will be executed every time `Scene.refresh()` is called, which happens a lot. The interval is defined by the controller (see ScrollMagic.Controller option `refreshInterval`).  
	 *   It's recomended to avoid calculations within the function and use cached variables as return values.  
	 *   This counts double if you use the same function for multiple scenes._
	 *
	 * @method ScrollMagic.Scene#duration
	 * @example
	 * // get the current duration value
	 * var duration = scene.duration();
	 *
	 * // set a new duration
	 * scene.duration(300);
	 *
	 * // set duration responsively to container size
	 * scene.duration("100%");
	 *
	 * // use a function to randomize the duration for some reason.
	 * var durationValueCache;
	 * function durationCallback () {
	 *   return durationValueCache;
	 * }
	 * function updateDuration () {
	 *   durationValueCache = Math.random() * 100;
	 * }
	 * updateDuration(); // set to initial value
	 * scene.duration(durationCallback); // set duration callback
	 *
	 * @fires {@link Scene.change}, when used as setter
	 * @fires {@link Scene.shift}, when used as setter
	 * @param {(number|string|function)} [newDuration] - The new duration setting for the scene.
	 * @returns {number} `get` -  Current scene duration.
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */

	/**
	 * **Get** or **Set** the offset option value.
	 * @method ScrollMagic.Scene#offset
	 * @example
	 * // get the current offset
	 * var offset = scene.offset();
	 *
		 * // set a new offset
	 * scene.offset(100);
	 *
	 * @fires {@link Scene.change}, when used as setter
	 * @fires {@link Scene.shift}, when used as setter
	 * @param {number} [newOffset] - The new offset of the scene.
	 * @returns {number} `get` -  Current scene offset.
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */

	/**
	 * **Get** or **Set** the triggerElement option value.
	 * Does **not** fire `Scene.shift`, because changing the trigger Element doesn't necessarily mean the start position changes. This will be determined in `Scene.refresh()`, which is automatically triggered.
	 * @method ScrollMagic.Scene#triggerElement
	 * @example
	 * // get the current triggerElement
	 * var triggerElement = scene.triggerElement();
	 *
		 * // set a new triggerElement using a selector
	 * scene.triggerElement("#trigger");
		 * // set a new triggerElement using a DOM object
	 * scene.triggerElement(document.getElementById("trigger"));
	 *
	 * @fires {@link Scene.change}, when used as setter
	 * @param {(string|object)} [newTriggerElement] - The new trigger element for the scene.
	 * @returns {(string|object)} `get` -  Current triggerElement.
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */

	/**
	 * **Get** or **Set** the triggerHook option value.
	 * @method ScrollMagic.Scene#triggerHook
	 * @example
	 * // get the current triggerHook value
	 * var triggerHook = scene.triggerHook();
	 *
		 * // set a new triggerHook using a string
	 * scene.triggerHook("onLeave");
		 * // set a new triggerHook using a number
	 * scene.triggerHook(0.7);
	 *
	 * @fires {@link Scene.change}, when used as setter
	 * @fires {@link Scene.shift}, when used as setter
	 * @param {(number|string)} [newTriggerHook] - The new triggerHook of the scene. See {@link Scene} parameter description for value options.
	 * @returns {number} `get` -  Current triggerHook (ALWAYS numerical).
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */

	/**
	 * **Get** or **Set** the reverse option value.
	 * @method ScrollMagic.Scene#reverse
	 * @example
	 * // get the current reverse option
	 * var reverse = scene.reverse();
	 *
		 * // set new reverse option
	 * scene.reverse(false);
	 *
	 * @fires {@link Scene.change}, when used as setter
	 * @param {boolean} [newReverse] - The new reverse setting of the scene.
	 * @returns {boolean} `get` -  Current reverse option value.
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */

	/**
	 * **Get** or **Set** the loglevel option value.
	 * @method ScrollMagic.Scene#loglevel
	 * @example
	 * // get the current loglevel
	 * var loglevel = scene.loglevel();
	 *
		 * // set new loglevel
	 * scene.loglevel(3);
	 *
	 * @fires {@link Scene.change}, when used as setter
	 * @param {number} [newLoglevel] - The new loglevel setting of the scene. `[0-3]`
	 * @returns {number} `get` -  Current loglevel.
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */

	/**
	 * **Get** the associated controller.
	 * @method ScrollMagic.Scene#controller
	 * @example
	 * // get the controller of a scene
	 * var controller = scene.controller();
	 *
	 * @returns {ScrollMagic.Controller} Parent controller or `undefined`
	 */
	controller() {
		return this._controller;
	};

	/**
	 * **Get** the current state.
	 * @method ScrollMagic.Scene#state
	 * @example
	 * // get the current state
	 * var state = scene.state();
	 *
	 * @returns {string} `"BEFORE"`, `"DURING"` or `"AFTER"`
	 */
	state() {
		return this._state;
	};

	/**
	 * **Get** the current scroll offset for the start of the scene.  
	 * Mind, that the scrollOffset is related to the size of the container, if `triggerHook` is bigger than `0` (or `"onLeave"`).  
	 * This means, that resizing the container or changing the `triggerHook` will influence the scene's start offset.
	 * @method ScrollMagic.Scene#scrollOffset
	 * @example
	 * // get the current scroll offset for the start and end of the scene.
	 * var start = scene.scrollOffset();
	 * var end = scene.scrollOffset() + scene.duration();
	 * console.log("the scene starts at", start, "and ends at", end);
	 *
	 * @returns {number} The scroll offset (of the container) at which the scene will trigger. Y value for vertical and X value for horizontal scrolls.
	 */
	scrollOffset() {
		return this._scrollOffset.start;
	};

	/**
	 * **Get** the trigger position of the scene (including the value of the `offset` option).  
	 * @method ScrollMagic.Scene#triggerPosition
	 * @example
	 * // get the scene's trigger position
	 * var triggerPosition = scene.triggerPosition();
	 *
	 * @returns {number} Start position of the scene. Top position value for vertical and left position value for horizontal scrolls.
	 */
	triggerPosition() {
		var pos = this._options.offset; // the offset is the basis
		if (this._controller) {
			// get the trigger position
			if (this._options.triggerElement) {
				// Element as trigger
				pos += this._triggerPos;
			} else {
				// return the height of the triggerHook to start at the beginning
				pos += this._controller.info("size") * Scene.triggerHook();
			}
		}
		return pos;
	};

	/**
	 * Update the start and end scrollOffset of the container.
	 * The positions reflect what the controller's scroll position will be at the start and end respectively.
	 * Is called, when:
	 *   - Scene event "change" is called with: offset, triggerHook, duration 
	 *   - scroll container event "resize" is called
	 *   - the position of the triggerElement changes
	 *   - the controller changes -> addTo()
	 * @private
	 */
	updateScrollOffset() {
		this._scrollOffset = {start: this._triggerPos + this._options.offset};
		if (this._controller && this._options.triggerElement) {
			// take away triggerHook portion to get relative to top
			this._scrollOffset.start -= this._controller.info("size") * this._options.triggerHook;
		}
		this._scrollOffset.end = this._scrollOffset.start + this._options.duration;
	};

	/**
	 * Updates the duration if set to a dynamic function.
	 * This method is called when the scene is added to a controller and in regular intervals from the controller through scene.refresh().
	 * 
	 * @fires {@link Scene.change}, if the duration changed
	 * @fires {@link Scene.shift}, if the duration changed
	 *
	 * @param {boolean} [suppressEvents=false] - If true the shift event will be suppressed.
	 * @private
	 */
	updateDuration(suppressEvents) {
		// update duration
		if (this._durationUpdateMethod) {
			var varname = "duration";
			if (this.changeOption(varname, this._durationUpdateMethod.call(Scene)) && !suppressEvents) { // set
				this.trigger("change", {what: varname, newval: this._options[varname]});
				this.trigger("shift", {reason: varname});
			}
		}
	};

	/**
	 * Updates the position of the triggerElement, if present.
	 * This method is called ...
	 *  - ... when the triggerElement is changed
	 *  - ... when the scene is added to a (new) controller
	 *  - ... in regular intervals from the controller through scene.refresh().
	 * 
	 * @fires {@link Scene.shift}, if the position changed
	 *
	 * @param {boolean} [suppressEvents=false] - If true the shift event will be suppressed.
	 * @private
	 */
	updateTriggerElementPosition(suppressEvents) {
		var
			elementPos = 0,
			telem = this._options.triggerElement;
		if (this._controller && (telem || this._triggerPos > 0)) { // either an element exists or was removed and the triggerPos is still > 0
			if (telem) { // there currently a triggerElement set
				if (telem.parentNode) { // check if element is still attached to DOM
					var
						controllerInfo = this._controller.info(),
						containerOffset = Get.offset(controllerInfo.container), // container position is needed because element offset is returned in relation to document, not in relation to container.
						param = controllerInfo.vertical ? "top" : "left"; // which param is of interest ?
						
					// if parent is spacer, use spacer position instead so correct start position is returned for pinned elements.
					while (telem.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) {
						telem = telem.parentNode;
					}

					var elementOffset = Get.offset(telem);

					if (!controllerInfo.isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
						containerOffset[param] -= this._controller.scrollPos();
					}

					elementPos = elementOffset[param] - containerOffset[param];

				} else { // there was an element, but it was removed from DOM
					this.log(2, "WARNING: triggerElement was removed from DOM and will be reset to", undefined);
					Scene.triggerElement(undefined); // unset, so a change event is triggered
				}
			}

			var changed = elementPos !== this._triggerPos;
			this._triggerPos = elementPos;
			if (changed && !suppressEvents) {
				Scene.trigger("shift", {reason: "triggerElementPosition"});
			}
		}
	};

	/**
	 * Trigger a shift event, when the container is resized and the triggerHook is > 1.
	 * @private
	 */
	onContainerResize(e) {
		if (this._options.triggerHook > 0) {
			Scene.trigger("shift", {reason: "containerResize"});
		}
	};

}

