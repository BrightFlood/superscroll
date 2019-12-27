import React, {Component} from 'react';
import {StageContext} from '../stage/context';
import {DirectorContext} from '../director/context';
import PropTypes from 'prop-types';
import {Util,Get, Type,PIN_SPACER_ATTRIBUTE} from '../../classes/util';

const
	NAMESPACE = 'SuperScroll.Scene',
	SCENE_STATE_BEFORE = 'BEFORE',
	SCENE_STATE_DURING = 'DURING',
	SCENE_STATE_AFTER = 'AFTER';

//Defines trigger regions on Stages
export default class Scene extends Component {
	constructor(props) {
		super(props);
		this.state = {
			state: SCENE_STATE_BEFORE,
			lastUpdate: null,
			progress: 0,
		};
	}

	componentDidMount() {
		const context = this.context;
		this.routineUpdate(true);
		if(context && context.events) {
			context.events.on('update', ()=>{
				const stateUpdate = {lastUpdate: this.context.lastUpdate};
				this.routineUpdate(true);
				this.setState(stateUpdate);
			})
		}
	}

	componentDidUpdate(prevProps) {
		//TODO: SOMETHING ISN'T RIGHT HERE
		if(this.props.triggerRef !== prevProps.triggerRef || this.state.lastUpdate !== this.context.lastUpdate) {
			const stateUpdate = {lastUpdate: this.context.lastUpdate};
			this.routineUpdate(true);
			this.setState(stateUpdate);
		}
	}

	get scrollOffset() {
		const scrollOffset = {start: this.triggerPosition + this.props.offset};
		if (this.context) {
			// take away triggerHook portion to get relative to top
			scrollOffset.start -= this.context.director.size * this.context.triggerHook;
		}
		console.log(this.props.name, 'start', scrollOffset.start)
		scrollOffset.end = scrollOffset.start + this.duration;
		return scrollOffset;
	}

	get isDisabled() {
		if(this.context && this.context.disabled) {
			return true;
		}
		return this.props.disabled;
	}

	get duration() {
		const dur = this.props.duration;
		if(Type.Number(dur)) {
			return dur;
		} else if(dur && Type.Number(dur.percent) && this.props.triggerRef) {
			return 0.01 * dur.percent * this.props.triggerRef.scrollHeight;
		} else if(dur && Type.Number(dur.percent) && this.context) {
			if(this.context.director.container.scrollHeight) {
				return 0.01 * dur.percent * this.context.director.container.scrollHeight;
			}
			else if(this.context.director.container.document) {
				return 0.01 * dur.percent * this.context.director.container.document.body.scrollHeight;
			}
			else {
				return 0;
			}
		}
		else {
			return 0;
		}
	}

	get triggerPosition() {
		let pos = 0;
		const {offset} = this.props;
		
		if(this.props.triggerRef) {
			pos = offset + this.triggerRefPos;
		}
		else if (this.context) {
			// get the trigger position
			// TODO: this doesn't make sense
			if (this.props.triggerRef) {
				// Element as trigger
				pos = offset + this.triggerRefPos;
			} else {
				// return the height of the triggerHook to start at the beginning
				const triggerHook = this.context.triggerHook;
				const viewportSize = this.context.director.size;
				pos = offset + (viewportSize * triggerHook);
			}
		}
		return pos;
	};

	get triggerRefPos() {
		let pos = 0;
		let triggerRef = this.props.triggerRef;
		//TODO: Verify this behavior
		if (triggerRef && triggerRef.parentNode) { // there currently a triggerRef set and it is attached to the DOM
			let directorContext = this.context.director;
			let containerOffset = Get.offset(directorContext.container); // container position is needed because element offset is returned in relation to document, not in relation to container.
			let param = directorContext.vertical ? "top" : "left"; // which param is of interest ?
			
			// if parent is spacer, use spacer position instead so correct start position is returned for pinned elements.
			//TODO: Probably not
			while (triggerRef.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) {
				triggerRef = triggerRef.parentNode;
			}

			//TODO: Probably not
			let elementOffset = Get.offset(triggerRef);

			//TODO: Probably not
			//TODO: INVESTIGATE, may have broken something by using context scrollPos instead of the getter
			if (!directorContext.isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
				containerOffset[param] -= directorContext.scrollPos;
			}

			pos = elementOffset[param] - containerOffset[param];
		}
		return pos;
	}
	// TODO: REACT, we need to make sure we track position and progress when a change comes in, also handle pins
	// TODO: INVESTIGATE, how does pinning work?
	routineUpdate(immediately) {
		if (this.context) {
			if (immediately) {
				if (!this.isDisabled) {
					let
						scrollPos = this.context.director.scrollPos,
						newProgress;

					const scrollOffset = this.scrollOffset;
					if (this.duration > 0) {
						newProgress = (scrollPos - scrollOffset.start)/(scrollOffset.end - scrollOffset.start);
					} else {
						newProgress = scrollPos >= scrollOffset.start ? 1 : 0;
					}
					this.progress(newProgress);

				} else if (this.state.pin && this.state.state === SCENE_STATE_DURING) {
					console.log('disabled')
					//this.updatePinState(true); // unpin in position
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
			let
				doUpdate = false,
				oldState = this.state.state,
				scrollDirection = this.context.director ? this.context.director.scrollDirection : 'PAUSED',
				reverseOrForward = this.props.reverse || progress >= this.state.progress;
			let newProgress, newState;

			if (this.duration === 0) {
				// zero duration scenes
				doUpdate = this.state.progress !== progress;
			 	newProgress = progress < 1 && reverseOrForward ? 0 : 1;
				newState = this.state.progress === 0 ? SCENE_STATE_BEFORE : SCENE_STATE_DURING;
				console.log(this.props.name, 'zero duration', newProgress)
			} else {
				// scenes with start and end
				if (progress < 0 && this.state.state !== SCENE_STATE_BEFORE && reverseOrForward) {
					// go back to initial state
					newProgress = progress = 0;
					newState = SCENE_STATE_BEFORE;
					console.log(this.props.name, 'back to initial', newProgress)
					doUpdate = true;
				} else if (progress >= 0 && progress < 1 && reverseOrForward) {
					newProgress = progress;
					newState = SCENE_STATE_DURING;
					console.log(this.props.name, 'making progress', newProgress)
					doUpdate = true;
				} else if (progress >= 1 && this.state.state !== SCENE_STATE_AFTER) {
					newProgress = progress = 1;
					newState = SCENE_STATE_AFTER;
					console.log(this.props.name, 'after', newProgress)
					doUpdate = true;
				} else if (this.state.state === SCENE_STATE_DURING && !reverseOrForward) {
					this.updatePinState(); // in case we scrolled backwards mid-scene and reverse is disabled => update the pin position, so it doesn't move back as well.
				}
			}
			if (doUpdate) {
				// fire events
				const scrollOffset = this.scrollOffset;
				var
					eventVars = {
						progress: newProgress,
						state: newState,
						reverse: this.props.reverse,
						scrollDirection: scrollDirection,
						start: scrollOffset.start,
						end: scrollOffset.end
					},
					stateChanged = newState !== oldState;

				var sendUpdate = (eventName)=>{ // tmp helper to simplify code
					this.context.updateScene(this.props.name, eventName, eventVars);
				};

				this.setState(eventVars)

				if (stateChanged) { // enter events
					if (oldState !== SCENE_STATE_DURING) {
						sendUpdate("enter");
						sendUpdate(oldState === SCENE_STATE_BEFORE ? "start" : "end");
					}
				}
				sendUpdate("progress");
				if (stateChanged) { // leave events
					if (this.state.state !== SCENE_STATE_DURING) {
						sendUpdate(this.state.state === SCENE_STATE_BEFORE ? "start" : "end");
						sendUpdate("leave");
					}
				}
			}
		}
	};

	render(){
		return null;
	}
}
Scene.contextType = StageContext;

//TODO: durationUpdateMethod is never used
Scene.defaultProps = {
	disabled: false,
	duration: 0,
	offset: 0,
	triggerRef: null, //TODO: maybe this may not be how we handle the same problem
	reverse: true,
	loglevel: 2
}

Scene.propTypes = {
	name: PropTypes.string.isRequired,
	disabled: PropTypes.bool
}