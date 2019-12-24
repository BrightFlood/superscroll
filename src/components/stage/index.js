
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
import Director from '../director';
import Actor from '../actor';
import Scene from '../scene';
import {StageContext} from './context';
import {Util,Get, Type,PIN_SPACER_ATTRIBUTE} from '../../classes/util';

// store pagewide scene options
// TODO: REACT, it looks like some of this will have to change in React
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

var
	NAMESPACE = 'SuperScroll.Stage',
	SCENE_STATE_BEFORE = 'BEFORE',
	SCENE_STATE_DURING = 'DURING',
	SCENE_STATE_AFTER = 'AFTER',
	DEFAULT_OPTIONS = SCENE_OPTIONS.defaults;

//Defines a container which encapsulates Scenes and Actors
// TODO: REACT, it looks like some of this will have to change in React
// TODO: NAMING, state.state is less than ideal
// TODO: NAMING, Scenes are becoming Stages for the most part
export default class Stage extends Component {
	constructor(props) {
		super(props);
		this.state = {
			options: Util.extend({}, DEFAULT_OPTIONS, props.options)
		}
		const protoState = {
			state: SCENE_STATE_BEFORE,
			lastUpdate: null,
			progress: 0,
			scrollOffset: {start: 0, end: 0}, // reflects the director's scroll position for the start and end of the scene respectively
			triggerPos: 0,
			enabled: true,
			durationUpdateMethod: {},
			listeners: {},
			cssClasses: [],
			cssClassElems: [],
			pin: null,
			pinOptions: null,
		}

		for (var key in this.state.options) { // check supplied options
			if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
				this.log(2, "WARNING: Unknown option \"" + key + "\"");
				delete this.state.options[key];
			}
		}

		this.state = {...this.state, ...protoState};

		// validate all options
		//this.validateOption();

	}

	componentDidMount() {
		// TODO: INVESTIGATE, all these event handlers
		// set event listeners
		this.on("change.internal", (e)=>{
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



		this
			.on("shift.internal", (e)=>{
				var durationChanged = e.reason === "duration";
				if ((this.state.state === SCENE_STATE_AFTER && durationChanged) || (this.state.state === SCENE_STATE_DURING && this.state.options.duration === 0)) {
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
				this.removePin(e.reset);
			});

		//from addTo
		//TODO: REACT, clean this up
		this.updateDuration(true);
		this.updateTriggerElementPosition(true);
		this.updateScrollOffset();
		//this.context.container.addEventListener('resize', this.onContainerResize.bind(this));
		this.trigger("add", {director: this.state.director});
		this.log(3, "added " + NAMESPACE + " to director");
		this.update();

		const {children} = this.props;
		console.log('Stage', children);
		const stages = React.Children.toArray(children).filter(child=> child.type === Stage);
		this.log(1, `${stages.length} stages in stage`)
		const scenes = React.Children.toArray(children).filter(child=> child.type === Scene);
		this.log(1, `${scenes.length} scenes in stage`)
		const actors = React.Children.toArray(children).filter(child=> child.type === Actor);
		this.log(1, `${actors.length} actors in stage`)
	}
	
	on() {
		console.log('on called')
		return this;
	}

	//TODO handle refresh events here
	componentDidUpdate(prevProps) {
		//TODO: if an external update happens do these things
		if(this.state.lastUpdate !== this.context.lastUpdate) {
			this.update(true);
			this.setState({lastUpdate: this.context.lastUpdate});
			//this.updateDuration();
			//this.updateTriggerElementPosition();
		}
	}

	get isDisabled() {
		const {disabled} = this.props;
		return disabled; //TODO or if parents are disabled
	}

	get stageContext() {
		return {
			lastUpdate: this.state.lastUpdate,
			progress: this.state.progress	
		}
	}

	render(){
		const {children, enabled} = this.props;
		return <DirectorContext.Consumer>
			{director=> (
				<StageContext.Consumer>
					{stage=> (
						<StageContext.Provider value={{...this.stageContext, depth: stage && stage.depth ? stage.depth + 1 : 1}}>
							<div>{this.props.children}</div>
						</StageContext.Provider>
					)}			
				</StageContext.Consumer>
			)}		
		</DirectorContext.Consumer>
	}

	log(loglevel, output) {
		if (this.state.options.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			Util.log.apply(window, arguments);
		}
	};

	//TODO: INVESTIGATE
	updateDuration(suppressEvents) {
		// update duration
		const {durationUpdateMethod} = this.props
		if (durationUpdateMethod && Type.Function(durationUpdateMethod)) {
			var varname = "duration";
			if (this.changeOption(varname, durationUpdateMethod.call(this)) && !suppressEvents) { // set
				this.trigger("change", {what: varname, newval: this.state.options[varname]});
				this.trigger("shift", {reason: varname});
			}
		}
	};

	//TODO: REACT, this might need to get moved or changed more for REACT
	updateTriggerElementPosition(suppressEvents) {
		var
			elementPos = 0,
			telem = this.state.options.triggerElement;
		if (this.context && (telem || this.state.triggerPos > 0)) { // either an element exists or was removed and the triggerPos is still > 0
			if (telem) { // there currently a triggerElement set
				if (telem.parentNode) { // check if element is still attached to DOM
					var
						directorContext = this.context,
						containerOffset = Get.offset(directorContext.container), // container position is needed because element offset is returned in relation to document, not in relation to container.
						param = directorContext.vertical ? "top" : "left"; // which param is of interest ?
						
					// if parent is spacer, use spacer position instead so correct start position is returned for pinned elements.
					while (telem.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) {
						telem = telem.parentNode;
					}

					var elementOffset = Get.offset(telem);

					//TODO: INVESTIGATE, may have broken something by using context scrollPos instead of the getter
					if (!directorContext.isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
						containerOffset[param] -= directorContext.scrollPos;
					}

					elementPos = elementOffset[param] - containerOffset[param];

				} else { // there was an element, but it was removed from DOM
					this.log(2, "WARNING: triggerElement was removed from DOM and will be reset to", undefined);
					this.triggerElement(undefined); // unset, so a change event is triggered
				}
			}

			var changed = elementPos !== this.state.triggerPos;
			this.setState({triggerPos: elementPos});
			if (changed && !suppressEvents) {
				this.trigger("shift", {reason: "triggerElementPosition"});
			}
		}
	};

	updateScrollOffset() {
		const scrollOffset = {start: this.state.triggerPos + this.state.options.offset};
		//TODO: REACT, use context instead of director
		if (this.context && this.state.options.triggerElement) {
			// take away triggerHook portion to get relative to top
			scrollOffset.start -= this.context.size * this.state.options.triggerHook;
		}
		scrollOffset.end = scrollOffset.start + this.state.options.duration;
		this.setState({scrollOffset});
	};

	// TODO: REACT, we need to make sure we track position and progress when a change comes in, also handle pins
	// TODO: INVESTIGATE, how does pinning work?
	update(immediately) {
		console.log('updating')
		if (this.context) {
			if (immediately) {
				if (!this.context.disabled && this.state.enabled) {
					var
						scrollPos = this.context.scrollPos,
						newProgress;

					if (this.state.options.duration > 0) {
						newProgress = (scrollPos - this.state.scrollOffset.start)/(this.state.scrollOffset.end - this.state.scrollOffset.start);
					} else {
						newProgress = scrollPos >= this.state.scrollOffset.start ? 1 : 0;
					}

					this.trigger("update", {startPos: this.state.scrollOffset.start, endPos: this.state.scrollOffset.end, scrollPos: scrollPos});

					this.progress(newProgress);
				} else if (this.state.pin && this.state.state === SCENE_STATE_DURING) {
					this.updatePinState(true); // unpin in position
				}
			} else {
				//TODO: REACT, force update from here
				//this.context.updateScene(this, false);
			}
		}
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
	 * @param {number} [progress] - The new progress value of the scene `[0-1]`.
	 * @returns {number} `get` -  Current scene progress.
	 * @returns {Scene} `set` -  Parent object for chaining.
	 */
	//TODO: REACT, this is the meat of the Stage, tracking progress as scrollpos changes
	//TODO: INVESTIGATE, understand this and figure out how to restructure it
	progress(progress) {
		if (!arguments.length) { // get
			return this.state.progress;
		} else { // set
			var
				doUpdate = false,
				oldState = this.state.state,
				scrollDirection = this.context ? this.context.scrollDirection : 'PAUSED',
				reverseOrForward = this.state.options.reverse || progress >= this.state.progress;
			if (this.state.options.duration === 0) {
				// zero duration scenes
				doUpdate = this.state.progress !== progress;
				const newProgress = progress < 1 && reverseOrForward ? 0 : 1;
				const newState = this.state.progress === 0 ? SCENE_STATE_BEFORE : SCENE_STATE_DURING;
				this.setState({
					progress: newProgress,
					state: newState
				})
			} else {
				// scenes with start and end
				if (progress < 0 && this.state.state !== SCENE_STATE_BEFORE && reverseOrForward) {
					// go back to initial state
					const newProgress = progress = 0;
					const newState = SCENE_STATE_BEFORE;
					this.setState({
						progress: newProgress,
						state: newState
					})
					doUpdate = true;
				} else if (progress >= 0 && progress < 1 && reverseOrForward) {
					const newProgress = progress;
					const newState = SCENE_STATE_DURING;
					this.setState({
						progress: newProgress,
						state: newState
					})
					doUpdate = true;
				} else if (progress >= 1 && this.state.state !== SCENE_STATE_AFTER) {
					const newProgress = progress = 1;
					const newState = SCENE_STATE_AFTER;
					this.setState({
						progress: newProgress,
						state: newState
					})
					doUpdate = true;
				} else if (this.state.state === SCENE_STATE_DURING && !reverseOrForward) {
					this.updatePinState(); // in case we scrolled backwards mid-scene and reverse is disabled => update the pin position, so it doesn't move back as well.
				}
			}
			if (doUpdate) {
				// fire events
				var
					eventVars = {progress: this.state.progress, state: this.state.state, scrollDirection: scrollDirection},
					stateChanged = this.state.state !== oldState;

				var trigger = (eventName)=>{ // tmp helper to simplify code
					this.trigger(eventName, eventVars);
				};

				if (stateChanged) { // enter events
					if (oldState !== SCENE_STATE_DURING) {
						trigger("enter");
						trigger(oldState === SCENE_STATE_BEFORE ? "start" : "end");
					}
				}
				trigger("progress");
				if (stateChanged) { // leave events
					if (this.state.state !== SCENE_STATE_DURING) {
						trigger(this.state.state === SCENE_STATE_BEFORE ? "start" : "end");
						trigger("leave");
					}
				}
			}
		}
	};

	get triggerPosition() {
		var pos = this.state.options.offset; // the offset is the basis
		if (this.context) {
			// get the trigger position
			if (this.state.options.triggerElement) {
				// Element as trigger
				pos += this.state.triggerPos;
			} else {
				// return the height of the triggerHook to start at the beginning
				pos += this.context.size * this.triggerHook();
			}
		}
		return pos;
	};
	
	//TODO: REACT, handle function props insead of events
	trigger(name, vars) {
		const {onStart, onEnd, onEnter, onLeave, onUpdate, onProgress, onChange, onShift, onMount, onUnmount, onRemove} = this.props;
	};

	// TODO: REACT, should happen naturally during the React cycle
	// TODO: INVESTIGATE, what is triggerHook
	onContainerResize(e) {
		if (this.state.options.triggerHook > 0) {
			this.trigger("shift", {reason: "containerResize"});
		}
	};

	//TODO: REACT, I'm not sure this is necessary at all
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
}
Stage.contextType = DirectorContext;