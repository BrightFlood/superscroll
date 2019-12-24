import React, {Component} from 'react';
import {DirectorContext} from './context';
import {Util,Get, Type,PIN_SPACER_ATTRIBUTE} from '../../classes/util';
import {Event} from '../../classes/event'
import Scene from '../scene';
import Stage from '../stage';
import Actor from '../actor';
import Assistant from '../assistant';

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
			sceneObjects: [],
			routineUpdateOnNextCycle: false,
			scrollPos: 0,
			scrollDirection: SCROLL_DIRECTION_PAUSED,
			isDocument: true,
			viewPortSize: 0,
			enabled: true,
			updateTimeout: null,
			refreshTimeout: null,
			directorContext: {}
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
		protoState.viewPortSize = this.viewportSize;
		this.log(1, protoState.viewPortSize);

		const refreshInterval = parseInt(this.state.options.refreshInterval, 10);
		this.state.options.refreshInterval = Type.Number(refreshInterval) 
			? refreshInterval 
			: DEFAULT_OPTIONS.refreshInterval;

		this.state = {...this.state, ...protoState};
	}

	render(){
		const {disabled, children} = this.props;
		const {directorContext} = this.state;

		const stages = React.Children.toArray(children).filter(child=> child.type === Stage);
		const scenes = React.Children.toArray(children).filter(child=> child.type === Scene);
		const actors = React.Children.toArray(children).filter(child=> child.type === Actor);
		const assistants = React.Children.toArray(children).filter(child=> child.type === Assistant);

		return <DirectorContext.Provider value={directorContext}>
			{children}
		</DirectorContext.Provider>
	}

	componentDidMount() {
		this.scheduleRefresh();
		//intitialize state and context
		this.setState(this.routineStateChanges());

		// set event handlers
		this.state.options.container.addEventListener("resize", this.onChange.bind(this));
		this.state.options.container.addEventListener("scroll", this.onChange.bind(this));


		const {children} = this.props;
		const stages = React.Children.toArray(children).filter(child=> child.type === Stage);
		this.log(1, `${stages.length} stages in director`)
		const scenes = React.Children.toArray(children).filter(child=> child.type === Scene);
		this.log(1, `${scenes.length} scenes in director`)
		const actors = React.Children.toArray(children).filter(child=> child.type === Actor);
		this.log(1, `${actors.length} actors in director`)
	}

	componentDidUpdate(){
		//TODO: REACT, if disabled changes, make sure to force updates
	}

	componentWillUnmount() {
		window.clearTimeout(this.state.refreshTimeout);
		this.state.options.container.removeEventListener("resize", this.onChange.bind(this));
		this.state.options.container.removeEventListener("scroll", this.onChange.bind(this));
		Util.cAF(this.state.updateTimeout);
		this.log(3, "unmount " + NAMESPACE );
	}

	get isDisabled() {
		const {disabled} = this.props;
		return disabled;
	}

	sortScenesReact(ScenesArray) {
		if (ScenesArray.length <= 1) {
			return ScenesArray;
		} else {
			var scenes = ScenesArray.slice(0);
			scenes.sort(function(a, b) {
				return a.props.offset > b.props.offset ? 1 : -1;
			});
			return scenes;
		}
	};

	log(loglevel, output) {
		if (this.state.options.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			Util.log.apply(window, arguments);
		}
	};
	
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
	
	get scrollPos() {
		const getScrollPos = this.props.getScrollPos && Type.Function(this.props.getScrollPos)
			? this.props.getScrollPos 
			: ()=>{
				return this.state.options.vertical ? Get.scrollTop(this.state.options.container) : Get.scrollLeft(this.state.options.container);
			}
		return getScrollPos();
	};

	/**
		* Returns the current viewport Size (width vor horizontal, height for vertical)
		* @private
	*/
	get viewportSize() {
		return this.state.options.vertical ? Get.height(this.state.options.container) : Get.width(this.state.options.container);
	};

	onChange(e) {
		this.log(3, "event fired causing an update:", e.type);
		if (e.type === "resize") {
			// resize
			const viewPortSize = this.viewportSize;
			const scrollDirection = SCROLL_DIRECTION_PAUSED;
			this.setState({
				viewPortSize,
				scrollDirection
			})
		}
		// schedule update
		//TODO: REACT
		if (this.state.routineUpdateOnNextCycle !== true) {
			const routineUpdateOnNextCycle = true;
			this.setState({
				routineUpdateOnNextCycle
			})
			this.debounceUpdate();
		}
	};

	scheduleRefresh() {
		if (this.state.options.refreshInterval > 0) {
			const refreshTimeout = window.setTimeout(this.refresh.bind(this), this.state.options.refreshInterval);
			this.setState({refreshTimeout});
		}
	}

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
		// TODO: make sure this is handled in STAGEs or SCENEs
		this.state.sceneObjects.forEach(function (scene, index) {// refresh all scenes
			scene.refresh();
		});
		this.scheduleRefresh();
	}

	debounceUpdate() {
		//TODO: REACT
		const updateTimeout = Util.rAF(this.handleScheduledUpdate.bind(this));
		this.setState({updateTimeout});
	};

	routineStateChanges() {
		const oldScrollPos = this.state.scrollPos;
		// update scroll pos now instead of onChange, as it might have changed since scheduling (i.e. in-browser smooth scroll)
		const scrollPos = this.scrollPos;
		var deltaScroll = scrollPos - oldScrollPos;

		let scrollDirection;
		if (deltaScroll !== 0) { // scroll position changed?
			scrollDirection = (deltaScroll > 0) 
				? SCROLL_DIRECTION_FORWARD 
				: SCROLL_DIRECTION_REVERSE;
		}

		const directorContext = {
			lastUpdate: Date.now(),
			size: this.state.viewPortSize, // contains height or width (in regard to orientation);
			vertical: this.state.options.vertical,
			scrollPos,
			scrollDirection,
			//container: this.state.options.container,
			isDocument: this.state.isDocument
		}

		return {
			scrollPos,
			scrollDirection,
			directorContext
		}
	}

	//TODO: INVESTIGATE, make sure order of updates of children doesn't matter
	handleScheduledUpdate() {
		if (this.state.enabled && this.state.routineUpdateOnNextCycle) {
			//reset update flag
			const routineUpdateOnNextCycle = false;
			
			const stateChanges = this.routineStateChanges();

			this.setState({
				...stateChanges,
				routineUpdateOnNextCycle,
			})
		}
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

	/**
	* Default function to set scroll pos - overwriteable using `Controller.scrollTo(newFunction)`
	* Make available publicly for pinned mousewheel workaround.
	* @private
	*/
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
}