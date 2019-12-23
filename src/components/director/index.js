import React, {Component} from 'react';
import {DirectorContext} from './context';
import {Util,Get, Type,PIN_SPACER_ATTRIBUTE} from '../../classes/util';
import {Event} from '../../classes/event'
import {Scene} from '../scene';
import {Stage} from '../stage';

// store pagewide controller options
let CONTROLLER_OPTIONS = {
	defaults: {
		container: window,
		vertical: true,
		globalSceneOptions: {},
		loglevel: 2,
		refreshInterval: 100
	}
};

/*
	* ----------------------------------------------------------------
	* settings
	* ----------------------------------------------------------------
*/
let
	NAMESPACE = 'ScrollMagic.Controller',
	SCROLL_DIRECTION_FORWARD = 'FORWARD',
	SCROLL_DIRECTION_REVERSE = 'REVERSE',
	SCROLL_DIRECTION_PAUSED = 'PAUSED',
	DEFAULT_OPTIONS = CONTROLLER_OPTIONS.defaults;

//Top-Level component which passes information about container and scrolling state to Stages, Scenes, and Actors
export default class Director extends Component {
	constructor(props){
		super(props);
		this.state = {
			options: Util.extend({}, DEFAULT_OPTIONS, props.options)
		}
		const protoState = {
			scrollState: {},
			sceneObjects: [],
			updateScenesOnNextCycle: false,
			scrollPos: 0,
			scrollDirection: SCROLL_DIRECTION_PAUSED,
			isDocument: true,
			viewPortSize: 0,
			enabled: true,
			updateTimeout: null,
			refreshTimeout: null,
			updateScrollState: (scrollState)=>{
				this.setState({scrollState})
			}
		}

		for (var key in this.state.options) {
			if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
				this.log(2, "WARNING: Unknown option \"" + key + "\"");
				delete this.state.options[key];
			}
		}

		this.state.options.container = Get.elements(this.state.options.container)[0];
		// check ScrollContainer
		if (!this.state.options.container) {
			this.log(1, "ERROR creating object " + NAMESPACE + ": No valid scroll container supplied");
			throw new Error(NAMESPACE + " init failed."); // cancel
		}
		protoState.isDocument = this.state.options.container === window 
			|| this.state.options.container === document.body 
			|| !window.document.body.contains(this.state.options.container);
		// normalize to window
		if (protoState.isDocument) {
			this.state.options.container = window;
		}
		// update container size immediately
		protoState.viewPortSize = this.getViewportSize();
		this.log(1, protoState.viewPortSize);

		const refreshInterval = parseInt(this.state.options.refreshInterval, 10);
		this.state.options.refreshInterval = Type.Number(refreshInterval) 
			? refreshInterval 
			: DEFAULT_OPTIONS.refreshInterval;

		this.state = {...this.state, ...protoState};
	}

	componentDidMount() {
		this.scheduleRefresh();

		// set event handlers
		this.state.options.container.addEventListener("resize", this.onChange.bind(this));
		this.state.options.container.addEventListener("scroll", this.onChange.bind(this));
	}

	//OKAY
	log(loglevel, output) {
		if (this.state.options.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			Util.log.apply(window, arguments);
		}
	};
	
	/**
	 * **Get** or **Set** the current loglevel option value.
	 * @public
	 *
	 * @example
	 * // get the current value
	 * var loglevel = controller.loglevel();
	 *
 	 * // set a new value
	 * controller.loglevel(3);
	 *
	 * @param {number} [newLoglevel] - The new loglevel setting of the Controller. `[0-3]`
	 * @returns {(number|Controller)} Current loglevel or parent object for chaining.
	 */
	loglevel(newLoglevel) {
		// (BUILD) - REMOVE IN MINIFY - START
		if (!arguments.length) { // get
			return this.state.options.loglevel;
		} else if (this.state.options.loglevel !== newLoglevel) { // set
			this.setState({
				...this.state.options,
				loglevel: newLoglevel
			})
		}
		// (BUILD) - REMOVE IN MINIFY - END
		return this;
	};
	
	/**
	* Schedule the next execution of the refresh function
	* @private
	*/
	//OKAY
	scheduleRefresh() {
		if (this.state.options.refreshInterval > 0) {
			const refreshTimeout = window.setTimeout(this.refresh.bind(this), this.state.options.refreshInterval);
			this.setState({refreshTimeout});
		}
	}

	/**
	* Default function to get scroll pos - overwriteable using `Controller.scrollPos(newFunction)`
	* @private
	*/
	//OKAY
	getScrollPos() {
		return this.state.options.vertical ? Get.scrollTop(this.state.options.container) : Get.scrollLeft(this.state.options.container);
	};

	/**
		* Returns the current viewport Size (width vor horizontal, height for vertical)
		* @private
	*/
	//OKAY
	getViewportSize() {
		return this.state.options.vertical ? Get.height(this.state.options.container) : Get.width(this.state.options.container);
	};

	/**
	* Default function to set scroll pos - overwriteable using `Controller.scrollTo(newFunction)`
	* Make available publicly for pinned mousewheel workaround.
	* @private
	*/
	//OKAY
	setScrollPos(pos) {
		if (this.state.options.vertical) {
			if (this.state.isDocument) {
				window.scrollTo(Get.scrollLeft(), pos);
			} else {
				//TODO: REACT
				//TODO: BROKEN
				this.state.options.container.scrollTop = pos;
			}
		} else {
			if (this.state.isDocument) {
				window.scrollTo(pos, Get.scrollTop());
			} else {
				//TODO: REACT
				//TODO: BROKEN
				this.state.options.container.scrollLeft = pos;
			}
		}
	};

	/**
	* Handle updates in cycles instead of on scroll (performance)
	* @private
	*/
	//OKAY
	updateScenes() {
		if (this.state.enabled && this.state.updateScenesOnNextCycle) {
			let updateScenesOnNextCycle,
				scrollPos,
				scrollDirection;
			// determine scenes to update
			// TODO: REACT
			const scenesToUpdate =	Type.Array(this.state.updateScenesOnNextCycle) ? this.state.updateScenesOnNextCycle : this.state.sceneObjects.slice(0);
			// reset scenes
			updateScenesOnNextCycle = false;
			const oldScrollPos = this.state.scrollPos;
			// update scroll pos now instead of onChange, as it might have changed since scheduling (i.e. in-browser smooth scroll)
			scrollPos = this.scrollPos();
			var deltaScroll = scrollPos - oldScrollPos;
			if (deltaScroll !== 0) { // scroll position changed?
				scrollDirection = (deltaScroll > 0) 
					? SCROLL_DIRECTION_FORWARD 
					: SCROLL_DIRECTION_REVERSE;
			}

			// reverse order of scenes if scrolling reverse
			if (scrollDirection === SCROLL_DIRECTION_REVERSE) {
				scenesToUpdate.reverse();
			}
			// update scenes
			//TODO: REACT
			scenesToUpdate.forEach(function (scene, index) {
				this.log(3, "updating Scene " + (index + 1) + "/" + scenesToUpdate.length + " (" + this.state.sceneObjects.length + " total)");
				scene.update(true);
			});

			this.setState({
				updateScenesOnNextCycle,
				scrollPos,
				scrollDirection
			})

			// (BUILD) - REMOVE IN MINIFY - START
			if (scenesToUpdate.length === 0 && this.state.options.loglevel >= 3) {
				this.log(3, "updating 0 Scenes (nothing added to controller)");
			}
			// (BUILD) - REMOVE IN MINIFY - END
		}
	};

	/**
	* Initializes rAF callback
	* @private
	*/
	//OKAY
	debounceUpdate() {
		//TODO: REACT
		const updateTimeout = Util.rAF(this.updateScenes.bind(this));
		this.setState({updateTimeout});
	};

	/**
	* Handles Container changes
	* @private
	*/
	//OKAY
	onChange(e) {
		this.log(3, "event fired causing an update:", e.type);
		if (e.type === "resize") {
			// resize
			const viewPortSize = this.getViewportSize();
			const scrollDirection = SCROLL_DIRECTION_PAUSED;
			this.setState({
				viewPortSize,
				scrollDirection
			})
		}
		// schedule update
		//TODO: REACT
		if (this.state.updateScenesOnNextCycle !== true) {
			const updateScenesOnNextCycle = true;
			this.setState({
				updateScenesOnNextCycle
			})
			this.debounceUpdate();
		}
	};

	//OKAY
	refresh() {
		//this.log(1, "Refreshing")
		//TODO: INVESTIGATE
		if (!this.state.isDocument) {
			// simulate resize event. Only works for viewport relevant param (performance)
			const viewPortSize =	this.getViewportSize();
			if (this.state.viewPortSize !== viewPortSize) {
				var resizeEvent;
				try {
					resizeEvent = new Event('resize', {bubbles: false, cancelable: false});
				} catch (e) { // stupid IE
					resizeEvent = window.document.createEvent("Event");
					resizeEvent.initEvent("resize", false, false);
				}
				this.state.options.container.dispatchEvent(resizeEvent);
			}
		}
		// TODO: REACT
		this.state.sceneObjects.forEach(function (scene, index) {// refresh all scenes
			scene.refresh();
		});
		this.scheduleRefresh();
	}

	/**
	 * Sort scenes in ascending order of their start offset.
	 * @private
	 *
	 * @param {array} ScenesArray - an array of ScrollMagic Scenes that should be sorted
	 * @return {array} The sorted array of Scenes.
	 */
	


	/**
	 * Scroll to a numeric scroll offset, a DOM element, the start of a scene or provide an alternate method for scrolling.  
	 * For vertical controllers it will change the top scroll offset and for horizontal applications it will change the left offset.
	 * @public
	 *
	 * @since 1.1.0
	 * @example
	 * // scroll to an offset of 100
	 * controller.scrollTo(100);
	 *
	 * // scroll to a DOM element
	 * controller.scrollTo("#anchor");
	 *
	 * // scroll to the beginning of a scene
	 * var scene = new ScrollMagic.Scene({offset: 200});
	 * controller.scrollTo(scene);
	 *
 	 * // define a new scroll position modification function (jQuery animate instead of jump)
	 * controller.scrollTo(function (newScrollPos) {
	 *	$("html, body").animate({scrollTop: newScrollPos});
	 * });
	 * controller.scrollTo(100); // call as usual, but the new function will be used instead
	 *
 	 * // define a new scroll function with an additional parameter
	 * controller.scrollTo(function (newScrollPos, message) {
	 *  console.log(message);
	 *	$(this).animate({scrollTop: newScrollPos});
	 * });
	 * // call as usual, but supply an extra parameter to the defined custom function
	 * controller.scrollTo(100, "my message");
	 *
 	 * // define a new scroll function with an additional parameter containing multiple variables
	 * controller.scrollTo(function (newScrollPos, options) {
	 *  someGlobalVar = options.a + options.b;
	 *	$(this).animate({scrollTop: newScrollPos});
	 * });
	 * // call as usual, but supply an extra parameter containing multiple options
	 * controller.scrollTo(100, {a: 1, b: 2});
	 *
 	 * // define a new scroll function with a callback supplied as an additional parameter
	 * controller.scrollTo(function (newScrollPos, callback) {
	 *	$(this).animate({scrollTop: newScrollPos}, 400, "swing", callback);
	 * });
	 * // call as usual, but supply an extra parameter, which is used as a callback in the previously defined custom scroll function
	 * controller.scrollTo(100, function() {
	 *	console.log("scroll has finished.");
	 * });
	 *
	 * @param {mixed} scrollTarget - The supplied argument can be one of these types:
	 * 1. `number` -> The container will scroll to this new scroll offset.
	 * 2. `string` or `object` -> Can be a selector or a DOM object.  
	 *  The container will scroll to the position of this element.
	 * 3. `ScrollMagic Scene` -> The container will scroll to the start of this scene.
	 * 4. `function` -> This function will be used for future scroll position modifications.  
	 *  This provides a way for you to change the behaviour of scrolling and adding new behaviour like animation. The function receives the new scroll position as a parameter and a reference to the container element using `this`.  
	 *  It may also optionally receive an optional additional parameter (see below)  
	 *  _**NOTE:**  
	 *  All other options will still work as expected, using the new function to scroll._
	 * @param {mixed} [additionalParameter] - If a custom scroll function was defined (see above 4.), you may want to supply additional parameters to it, when calling it. You can do this using this parameter – see examples for details. Please note, that this parameter will have no effect, if you use the default scrolling function.
	 * @returns {Controller} Parent object for chaining.
	 */
	//TODO: REACT
	//TODO: NAMING, changing scene to stage potentially
	//TODO: BROKEN, this isn't how it should work in react
	//TODO: BROKEN, scene function may not be working
	//OKAY
	scrollTo(scrollTarget, additionalParameter) {
		if (Type.Number(scrollTarget)) { // excecute
			this.setScrollPos.call(this.state.options.container, scrollTarget, additionalParameter);
		} else if (scrollTarget instanceof Scene) { // scroll to scene
			if (scrollTarget.controller() === this) { // check if the controller is associated with this scene
				this.scrollTo(scrollTarget.scrollOffset(), additionalParameter);
			} else {
				this.log (2, "scrollTo(): The supplied scene does not belong to this controller. Scroll cancelled.", scrollTarget);
			}
		} else if (Type.Function(scrollTarget)) { // assign new scroll function
			this.setScrollPos = scrollTarget;
		} else { // scroll to element
			var elem = Get.elements(scrollTarget)[0];
			if (elem) {
				//TODO: INVESTIGATE, what is a pin spacer?
				// if parent is pin spacer, use spacer position instead so correct start position is returned for pinned elements.
				while (elem.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) {
					elem = elem.parentNode;
				}

				var
					param = this.state.options.vertical ? "top" : "left", // which param is of interest ?
					containerOffset = Get.offset(this._options.container), // container position is needed because element offset is returned in relation to document, not in relation to container.
					elementOffset = Get.offset(elem);

				if (!this.state.isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
					containerOffset[param] -= this.scrollPos();
				}

				this.scrollTo(elementOffset[param] - containerOffset[param], additionalParameter);
			} else {
				this.log (2, "scrollTo(): The supplied argument is invalid. Scroll cancelled.", scrollTarget);
			}
		}
		return this;
	};

	/**
	 * **Get** the current scrollPosition or **Set** a new method to calculate it.  
	 * -> **GET**:
	 * When used as a getter this function will return the current scroll position.  
	 * To get a cached value use Controller.info("scrollPos"), which will be updated in the update cycle.  
	 * For vertical controllers it will return the top scroll offset and for horizontal applications it will return the left offset.
	 *
	 * -> **SET**:
	 * When used as a setter this method prodes a way to permanently overwrite the controller's scroll position calculation.  
	 * A typical usecase is when the scroll position is not reflected by the containers scrollTop or scrollLeft values, but for example by the inner offset of a child container.  
	 * Moving a child container inside a parent is a commonly used method for several scrolling frameworks, including iScroll.  
	 * By providing an alternate calculation function you can make sure ScrollMagic receives the correct scroll position.  
	 * Please also bear in mind that your function should return y values for vertical scrolls an x for horizontals.
	 *
	 * To change the current scroll position please use `Controller.scrollTo()`.
	 * @public
	 *
	 * @example
	 * // get the current scroll Position
	 * var scrollPos = controller.scrollPos();
	 *
 	 * // set a new scroll position calculation method
	 * controller.scrollPos(function () {
	 *	return this.info("vertical") ? -mychildcontainer.y : -mychildcontainer.x
	 * });
	 *
	 * @param {function} [scrollPosMethod] - The function to be used for the scroll position calculation of the container.
	 * @returns {(number|Controller)} Current scroll position or parent object for chaining.
	 */
	//OKAY
	scrollPos(scrollPosMethod) {
		if (!arguments.length) { // get
			return this.getScrollPos.call(this);
		} else { // set
			//TODO: REACT, ES6
			if (Type.Function(scrollPosMethod)) {
				this.getScrollPos = scrollPosMethod;
			} else {
				this.log(2, "Provided value for method 'scrollPos' is not a function. To change the current scroll position use 'scrollTo()'.");
			}
		}
		return this;
	};

	/**
	 * **Get** all infos or one in particular about the controller.
	 * @public
	 * @example
	 * // returns the current scroll position (number)
	 * var scrollPos = controller.info("scrollPos");
	 *
	 * // returns all infos as an object
	 * var infos = controller.info();
	 *
	 * @param {string} [about] - If passed only this info will be returned instead of an object containing all.  
	 							 Valid options are:
	 							 ** `"size"` => the current viewport size of the container
	 							 ** `"vertical"` => true if vertical scrolling, otherwise false
	 							 ** `"scrollPos"` => the current scroll position
	 							 ** `"scrollDirection"` => the last known direction of the scroll
	 							 ** `"container"` => the container element
	 							 ** `"isDocument"` => true if container element is the document.
	 * @returns {(mixed|object)} The requested info(s).
	 */
	//TODO: REACT
	//TODO: BROKEN, this isn't how it should work in react
	//OKAY
	info(about) {
		var values = {
			size: this.state.viewPortSize, // contains height or width (in regard to orientation);
			vertical: this.state.options.vertical,
			scrollPos: this.state.scrollPos,
			scrollDirection: this.state.scrollDirection,
			container: this.state.options.container,
			isDocument: this.state.isDocument
		};
		if (!arguments.length) { // get all as an object
			return values;
		} else if (values[about] !== undefined) {
			return values[about];
		} else {
			this.log(1, "ERROR: option \"" + about + "\" is not available");
			return;
		}
	};
	
	render(){
		const {viewPortSize, scrollPos, scrollDirection, options:{refreshInterval}} = this.state;
		return <DirectorContext.Provider value={{director: {viewPortSize, scrollPos, scrollDirection, refreshInterval}}}>
			{this.props.children}
		</DirectorContext.Provider>
	}
	
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW
	//REFACTOR BELOW

	//OKAY
	//TODO: REACT
	//TODO: NAMING
	sortScenes(ScenesArray) {
		if (ScenesArray.length <= 1) {
			return ScenesArray;
		} else {
			var scenes = ScenesArray.slice(0);
			scenes.sort(function(a, b) {
				return a.scrollOffset() > b.scrollOffset() ? 1 : -1;
			});
			return scenes;
		}
	};

	/**
	 * **Get** or **Set** the current enabled state of the controller.  
	 * This can be used to disable all Scenes connected to the controller without destroying or removing them.
	 * @public
	 *
	 * @example
	 * // get the current value
	 * var enabled = controller.enabled();
	 *
 	 * // disable the controller
	 * controller.enabled(false);
	 *
	 * @param {boolean} [newState] - The new enabled state of the controller `true` or `false`.
	 * @returns {(boolean|Controller)} Current enabled state or parent object for chaining.
	 */
	//TODO: REACT
	//TODO: NAMING, changing scene to stage potentially
	//TODO: BROKEN, this isn't how it should work in react
	//TODO: BROKEN, scene function may not be working
	//OKAY
	enabled(newState) {
		if (!arguments.length) { // get
			return this.state.enabled;
		} else if (this.state.enabled !== newState) { // set
			this.setState({enabled:!!newState});
			this.updateScene(this.state.sceneObjects, true);
		}
		return this;
	};
	
	/**
	 * Destroy the Controller, all Scenes and everything.
	 * @public
	 *
	 * @example
	 * // without resetting the scenes
	 * controller = controller.destroy();
	 *
 	 * // with scene reset
	 * controller = controller.destroy(true);
	 *
	 * @param {boolean} [resetScenes=false] - If `true` the pins and tweens (if existent) of all scenes will be reset.
	 * @returns {null} Null to unset handler variables.
	 */
	//TODO: REACT
	//TODO: NAMING, changing scene to stage potentially
	//TODO: BROKEN, this isn't how it should work in react
	//TODO: BROKEN, scene function may not be working
	//OKAY
	destroy(resetScenes) {
		window.clearTimeout(this.state.refreshTimeout);
		var i = this.state.sceneObjects.length;
		while (i--) {
			this.state.sceneObjects[i].destroy(resetScenes);
		}
		this.state.options.container.removeEventListener("resize", this.onChange.bind(this));
		this.state.options.container.removeEventListener("scroll", this.onChange.bind(this));
		Util.cAF(this.state.updateTimeout);
		this.log(3, "destroyed " + NAMESPACE + " (reset: " + (resetScenes ? "true" : "false") + ")");
		return null;
	};



	/**
	 * Add one ore more scene(s) to the controller.  
	 * This is the equivalent to `Scene.addTo(controller)`.
	 * @public
	 * @example
	 * // with a previously defined scene
	 * controller.addScene(scene);
	 *
 	 * // with a newly created scene.
	 * controller.addScene(new ScrollMagic.Scene({duration : 0}));
	 *
 	 * // adding multiple scenes
	 * controller.addScene([scene, scene2, new ScrollMagic.Scene({duration : 0})]);
	 *
	 * @param {(ScrollMagic.Scene|array)} newScene - ScrollMagic Scene or Array of Scenes to be added to the controller.
	 * @return {Controller} Parent object for chaining.
	 */
	//TODO: REACT
	//TODO: NAMING, changing scene to stage potentially
	//TODO: BROKEN, this isn't how it should work in react
	//TODO: BROKEN, scene function may not be working
	//NOTE: PROBABLY UNNECESSARY
	addScene(newScene) {
		if (Type.Array(newScene)) {
			newScene.forEach(function (scene, index) {
				this.addScene(scene);
			});
		} else if (newScene instanceof Scene) {
			if (newScene.controller() !== this) {
				newScene.addTo(this);
			} else if (this.state.sceneObjects.indexOf(newScene) < 0){
				// new scene
				let sceneObjects = [...this.state.sceneObjects]
				sceneObjects.push(newScene); // add to array
				sceneObjects = this.sortScenes(sceneObjects); // sort
				newScene.on("shift.controller_sort", ()=>{ // resort whenever scene moves
					sceneObjects = this.sortScenes(sceneObjects);
				});
				// insert Global defaults.
				// TODO: ES6
				for (var key in this.state.options.globalSceneOptions) {
					if (newScene[key]) {
						newScene[key].call(newScene, this.state.options.globalSceneOptions[key]);
					}
				}
				this.log(3, "adding Scene (now " + this._sceneObjects.length + " total)");
			}
		} else {
			this.log(1, "ERROR: invalid argument supplied for '.addScene()'");
		}
		return this;
	};

	/**
	 * Remove one ore more scene(s) from the controller.  
	 * This is the equivalent to `Scene.remove()`.
	 * @public
	 * @example
	 * // remove a scene from the controller
	 * controller.removeScene(scene);
	 *
	 * // remove multiple scenes from the controller
	 * controller.removeScene([scene, scene2, scene3]);
	 *
	 * @param {(ScrollMagic.Scene|array)} Scene - ScrollMagic Scene or Array of Scenes to be removed from the controller.
	 * @returns {Controller} Parent object for chaining.
	 */
	//TODO: REACT
	//TODO: NAMING, changing scene to stage potentially
	//TODO: BROKEN, this isn't how it should work in react
	//TODO: BROKEN, scene function may not be working
	//NOTE: PROBABLY UNNECESSARY
	removeScene(Scene) {
		if (Type.Array(Scene)) {
			Scene.forEach(function (scene, index) {
				this.removeScene(scene);
			});
		} else {
			let sceneObjects = [...this.state.sceneObjects];
			var index = sceneObjects.indexOf(Scene);
			if (index > -1) {
				Scene.off("shift.controller_sort");
				sceneObjects.splice(index, 1);
				this.log(3, "removing Scene (now " + sceneObjects.length + " left)");
				Scene.remove();
			}
		}
		return this;
	};

	/**
	 * Update one ore more scene(s) according to the scroll position of the container.  
	 * This is the equivalent to `Scene.update()`.  
	 * The update method calculates the scene's start and end position (based on the trigger element, trigger hook, duration and offset) and checks it against the current scroll position of the container.  
	 * It then updates the current scene state accordingly (or does nothing, if the state is already correct) – Pins will be set to their correct position and tweens will be updated to their correct progress.  
	 * _**Note:** This method gets called constantly whenever Controller detects a change. The only application for you is if you change something outside of the realm of ScrollMagic, like moving the trigger or changing tween parameters._
	 * @public
	 * @example
	 * // update a specific scene on next cycle
 	 * controller.updateScene(scene);
 	 *
	 * // update a specific scene immediately
	 * controller.updateScene(scene, true);
 	 *
	 * // update multiple scenes scene on next cycle
	 * controller.updateScene([scene1, scene2, scene3]);
	 *
	 * @param {ScrollMagic.Scene} Scene - ScrollMagic Scene or Array of Scenes that is/are supposed to be updated.
	 * @param {boolean} [immediately=false] - If `true` the update will be instant, if `false` it will wait until next update cycle.  
	 										  This is useful when changing multiple properties of the scene - this way it will only be updated once all new properties are set (updateScenes).
	 * @return {Controller} Parent object for chaining.
	 */
	//TODO: REACT
	//TODO: NAMING, changing scene to stage potentially
	//TODO: BROKEN, this isn't how it should work in react
	//TODO: BROKEN, scene function may not be working
	//NOTE: PROBABLY UNNECESSARY
	updateScene(Scene, immediately) {
		if (Type.Array(Scene)) {
			Scene.forEach(function (scene, index) {
				this.updateScene(scene, immediately);
			});
		} else {
			if (immediately) {
				Scene.update(true);
			} else if (this.state.updateScenesOnNextCycle !== true && Scene instanceof Scene) { // if _updateScenesOnNextCycle is true, all connected scenes are already scheduled for update
				// prep array for next update cycle
				let updateScenesOnNextCycle = this.state.updateScenesOnNextCycle || [];
				updateScenesOnNextCycle = [...updateScenesOnNextCycle];
				if (updateScenesOnNextCycle.indexOf(Scene) === -1) {
					updateScenesOnNextCycle.push(Scene);	
				}
				updateScenesOnNextCycle = this.sortScenes(updateScenesOnNextCycle); // sort
				this.setState(updateScenesOnNextCycle, ()=>{
					this.debounceUpdate();
				})
			}
		}
		return this;
	};
	
	/**
	 * Updates the controller params and calls updateScene on every scene, that is attached to the controller.  
	 * See `Controller.updateScene()` for more information about what this means.  
	 * In most cases you will not need this function, as it is called constantly, whenever ScrollMagic detects a state change event, like resize or scroll.  
	 * The only application for this method is when ScrollMagic fails to detect these events.  
	 * One application is with some external scroll libraries (like iScroll) that move an internal container to a negative offset instead of actually scrolling. In this case the update on the controller needs to be called whenever the child container's position changes.
	 * For this case there will also be the need to provide a custom function to calculate the correct scroll position. See `Controller.scrollPos()` for details.
	 * @public
	 * @example
	 * // update the controller on next cycle (saves performance due to elimination of redundant updates)
	 * controller.update();
	 *
 	 * // update the controller immediately
	 * controller.update(true);
	 *
	 * @param {boolean} [immediately=false] - If `true` the update will be instant, if `false` it will wait until next update cycle (better performance)
	 * @return {Controller} Parent object for chaining.
	 */
	//TODO: REACT
	//TODO: NAMING, changing scene to stage potentially
	//TODO: BROKEN, this isn't how it should work in react
	//NOTE: PROBABLY UNNECESSARY
	update(immediately) {
		this.onChange({type: "resize"}); // will update size and set _updateScenesOnNextCycle to true
		if (immediately) {
			this.updateScenes();
		}
		return this;
	};
}