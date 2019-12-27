import React, {Component} from 'react';
import {DirectorContext, DirectorContextManager} from './context';
import {Util,Get, Type,PIN_SPACER_ATTRIBUTE} from '../../classes/util';
import EventEmitter from 'events';
import Scene from '../scene';
import Stage from '../stage';
import Actor from '../actor';
import Assistant from '../assistant';
import PropTypes from 'prop-types';

const NAMESPACE = 'ScrollMagic.Director';

export const SCROLL_DIRECTION = {
	FORWARD: 'FORWARD',
	REVERSE: 'REVERSE',
	PAUSED: 'PAUSED'
}

const DEFAULT_OPTIONS = {
	container: window,
	vertical: true,
	globalSceneOptions: {},
	loglevel: 2,
	refreshInterval: 100
}
//Top-Level component which passes information about container and scrolling state to Stages, Scenes, and Actors
export default class Director extends Component {	
	constructor(props){
		super(props);

		const protoState = {
			...DEFAULT_OPTIONS,
			lastUpdate: Date.now(),
			sceneObjects: [],
			routineUpdateOnNextCycle: false,
			scrollPos: 0,
			scrollDirection: SCROLL_DIRECTION.PAUSED,
			isDocument: true,
			viewPortSize: 0,
			enabled: true,
			updateTimeout: null,
			refreshTimeout: null
		}

		this.events = new EventEmitter();
		console.log(this.events)

		//TODO: SOME KIND OF VALIDATION

		protoState.container = Get.elements(protoState.container)[0];
		// check ScrollContainer
		if (!protoState.container) {
			this.log(1, "ERROR creating object " + NAMESPACE + ": No valid scroll container supplied");
			throw new Error(NAMESPACE + " init failed."); // cancel
		}

		protoState.isDocument = protoState.container === window 
			|| protoState.container === document.body 
			|| !window.document.body.contains(protoState.container);
		// normalize to window
		if (protoState.isDocument) {
			protoState.container = window;
		}

		const refreshInterval = parseInt(protoState.refreshInterval, 10);
		protoState.refreshInterval = Type.Number(refreshInterval) 
			? refreshInterval 
			: DEFAULT_OPTIONS.refreshInterval;

		this.state = protoState;
	}

	log(loglevel, output) {
		if (this.state.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			Util.log.apply(window, arguments);
		}
	};
	
	loglevel(newLoglevel) {
		// (BUILD) - REMOVE IN MINIFY - START
		if (!arguments.length) { // get
			return this.state.loglevel;
		} else if (this.state.loglevel !== newLoglevel) { // set
			this.setState({
				...this.state,
				loglevel: newLoglevel
			})
		}
		// (BUILD) - REMOVE IN MINIFY - END
		return this;
	};


	componentDidMount() {
		const {children} = this.props;

		// set event handlers
		this.state.container.addEventListener("resize", this.onChange.bind(this));
		this.state.container.addEventListener("scroll", this.onChange.bind(this));

		this.scheduleRefresh();
		// update container size immediately
		const viewPortSize = this.viewportSize;
		this.log(1, viewPortSize);

		//initialize viewport size then initialize everything
		this.setState({viewPortSize}, ()=>{
			//intitialize state and context
			this.setState(this.routineStateChanges());
		})

		const stages = React.Children.toArray(children).filter(child=> child.type === Stage);
		this.log(1, `${stages.length} stages in director`)
		const scenes = React.Children.toArray(children).filter(child=> child.type === Scene);
		this.log(1, `${scenes.length} scenes in director`)
		const actors = React.Children.toArray(children).filter(child=> child.type === Actor);
		this.log(1, `${actors.length} actors in director`)
	}

	componentWillUnmount() {
		this.state.container.removeEventListener("resize", this.onChange.bind(this));
		this.state.container.removeEventListener("scroll", this.onChange.bind(this));

		window.clearTimeout(this.state.refreshTimeout);
		Util.cAF(this.state.updateTimeout);
		this.log(3, "unmount " + NAMESPACE );
	}

	scheduleRefresh() {
		if (this.state.refreshInterval > 0) {
			const refreshTimeout = window.setTimeout(this.refresh.bind(this), this.state.refreshInterval);
			this.setState({refreshTimeout});
		}
	}

	get isDisabled() {
		const {disabled} = this.props;
		return disabled;
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
				this.state.container.dispatchEvent(resizeEvent);
			}
		}
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
				? SCROLL_DIRECTION.FORWARD 
				: SCROLL_DIRECTION.REVERSE;
		} else {
			scrollDirection = SCROLL_DIRECTION.PAUSED;
		}

		return {
			scrollPos,
			scrollDirection,
			lastUpdate: Date.now()
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
			}, this.emitUpdate.bind(this))
		}
	}

	emitUpdate() {
		this.events.emit('update', this.directorContext);
	}

	get scrollPos() {
		const getScrollPos = this.props.getScrollPos && Type.Function(this.props.getScrollPos)
			? this.props.getScrollPos 
			: ()=>{
				return this.state.vertical ? Get.scrollTop(this.state.container) : Get.scrollLeft(this.state.container);
			}
		return getScrollPos();
	};

	/**
		* Returns the current viewport Size (width vor horizontal, height for vertical)
		* @private
	*/
	get viewportSize() {
		return this.state.vertical ? Get.height(this.state.container) : Get.width(this.state.container);
	};

	onChange(e) {
		this.log(3, "event fired causing an update:", e.type);
		if (e.type === "resize") {
			// resize
			const viewPortSize = this.viewportSize;
			const scrollDirection = SCROLL_DIRECTION.PAUSED;
			this.setState({
				viewPortSize,
				scrollDirection
			}, ()=>{
				this.emitResize()
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

	emitResize() {
		this.events.emit('resize', this.state);
	}

	sortScenes(sceneComps) {
		if (sceneComps.length <= 1) {
			return sceneComps;
		} else {
			var scenes = sceneComps.slice(0);
			scenes.sort(function(a, b) {
				return a.props.offset > b.props.offset ? 1 : -1;
			});
			return scenes;
		}
	};

	get directorContext() {
		const contextBody = {
			lastUpdate: this.state.lastUpdate,
			disabled: this.props.isDisabled || false,
			size: this.state.viewPortSize, // contains height or width (in regard to orientation);
			vertical: this.state.vertical,
			scrollPos: this.state.scrollPos,
			scrollDirection: this.state.scrollDirection,
			container: this.state.container,
			isDocument: this.state.isDocument,
			events: this.events
		}
		const toString = ()=>{
			const safeCopy = {...contextBody};
			delete safeCopy['container'];
			delete safeCopy['events'];
			return JSON.stringify(safeCopy, null, 4);
		}
		return {
			...contextBody,
			toString
		};
	}

	render(){
		const {disabled, children} = this.props;

		const stages = React.Children.toArray(children).filter(child=> child.type === Stage);
		const scenes = React.Children.toArray(children).filter(child=> child.type === Scene);
		const actors = React.Children.toArray(children).filter(child=> child.type === Actor);
		const assistants = React.Children.toArray(children).filter(child=> child.type === Assistant);

		return <DirectorContext.Provider value={this.directorContext}>
			{children}
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




	/**
	* Default function to set scroll pos - overwriteable using `Controller.scrollTo(newFunction)`
	* Make available publicly for pinned mousewheel workaround.
	* @private
	*/
	setScrollPos(pos) {
		if (this.state.vertical) {
			if (this.state.isDocument) {
				window.scrollTo(Get.scrollLeft(), pos);
			} else {
				//TODO: REACT
				//TODO: BROKEN
				this.state.container.scrollTop = pos;
			}
		} else {
			if (this.state.isDocument) {
				window.scrollTo(pos, Get.scrollTop());
			} else {
				//TODO: REACT
				//TODO: BROKEN
				this.state.container.scrollLeft = pos;
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
			this.setScrollPos.call(this.state.container, scrollTarget, additionalParameter);
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
					param = this.state.vertical ? "top" : "left", // which param is of interest ?
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
Director.defaultProps = {
	container: window,
	vertical: true,
	globalSceneOptions: {},
	loglevel: 2,
	refreshInterval: 100
}

Director.propTypes = {
	vertical: PropTypes.bool,
	refreshInterval: PropTypes.number
}