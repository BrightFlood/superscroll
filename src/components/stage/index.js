
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
import Director from '../director';
import Actor from '../actor';
import Scene from '../scene';
import {StageContext} from './context';
import {Util,Get, Type,PIN_SPACER_ATTRIBUTE} from '../../classes/util';
import PropTypes from 'prop-types';
import EventEmitter from 'events';

const
	NAMESPACE = 'SuperScroll.Stage',
	SCENE_STATE_BEFORE = 'BEFORE',
	SCENE_STATE_DURING = 'DURING',
	SCENE_STATE_AFTER = 'AFTER';

export default class Stage extends Component {
	constructor(props) {
		super(props);
		this.state = {
			state: SCENE_STATE_BEFORE,
			lastUpdate: null,
			progress: 0,
			scrollOffset: {start: 0, end: 0}, // reflects the director's scroll position for the start and end of the scene respectively
			triggerPos: 0,
		};

		this.events = new EventEmitter();
	}

	// TODO: INVESTIGATE, do we need internal event handlers?
	// TODO: INVESTIGATE, do we need to initialize state?
	componentDidMount() {
		const context = this.context;
		if(context && context.events) {
			context.events.on('update', ()=>{
				const stateUpdate = {lastUpdate: this.context.lastUpdate};
				this.routineUpdate(true);
				this.setState(stateUpdate);
			})
			context.events.on('resize', ()=>{
				if (this.props.triggerHook > 0) {
					this.emit("shift", {reason: "containerResize"});
				}
			})
		}

		const {children} = this.props;
		console.log('Stage', children);
		const stages = React.Children.toArray(children).filter(child=> child.type === Stage);
		console.log(`${stages.length} stages in stage`)
		const scenes = React.Children.toArray(children).filter(child=> child.type === Scene);
		console.log(`${scenes.length} scenes in stage`)
		const actors = React.Children.toArray(children).filter(child=> child.type === Actor);
		console.log(`${actors.length} actors in stage`)
	}

	componentDidUpdate(prevProps) {
		//TODO: SOMETHING ISN'T RIGHT HERE
		if(this.props.triggerRef !== prevProps.triggerRef) {
			const stateUpdate = {lastUpdate: this.context.lastUpdate};
			this.routineUpdate(true);
			this.setState(stateUpdate);
		}
	}

	get scrollOffset() {
		const scrollOffset = {start: this.triggerPosition + this.props.offset};
		if (this.context && this.props.triggerRef) {
			// take away triggerHook portion to get relative to top
			scrollOffset.start -= this.context.size * this.props.triggerHook;
		}
		scrollOffset.end = scrollOffset.start + this.duration;
		return scrollOffset;
	}

	get isDisabled() {
		if(this.context && this.context.disabled) {
			return true;
		}
		return this.props.disabled;
	}

	get stageContext() {
		return {
			lastUpdate: this.state.lastUpdate,
			progress: this.state.progress,
			duration: this.duration,
			offset: this.props.offset,
			scrollOffset: this.scrollOffset,
			triggerRef: this.props.triggerRef? "true": "false",
			triggerHook: this.props.triggerHook,
			triggerPos: this.triggerPosition
		}
	}

	get duration() {
		const dur = this.props.duration;
		if(Type.Number(dur)) {
			return dur;
		} else if(dur && Type.Number(dur.percent) && this.props.triggerRef && this.context) {
			return 0.01 * dur.percent * this.props.triggerRef.scrollHeight;
		} else if(dur && Type.Number(dur.percent) && this.context) {
			if(this.context.container.scrollHeight) {
				return 0.01 * dur.percent * this.context.container.scrollHeight;
			}
			else if(this.context.container.document) {
				return 0.01 * dur.percent * this.context.container.document.body.scrollHeight;
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
		const {offset} = this.props; // the offset is the basis
		
		if(this.props.triggerRef) {
			pos = offset + this.triggerRefPos;
		}
		else if (this.context) {
			// get the trigger position
			if (this.props.triggerRef) {
				// Element as trigger
				pos = offset + this.triggerRefPos;
			} else {
				// return the height of the triggerHook to start at the beginning
				const triggerHook = this.props.triggerHook;
				const viewportSize = this.context.size;
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
			let directorContext = this.context;
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
						scrollPos = this.context.scrollPos,
						newProgress;

					if (this.duration > 0) {
						newProgress = (scrollPos - this.scrollOffset.start)/(this.scrollOffset.end - this.scrollOffset.start);
					} else {
						newProgress = scrollPos >= this.scrollOffset.start ? 1 : 0;
					}
					this.emit("update", this.stageContext);
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
				scrollDirection = this.context ? this.context.scrollDirection : 'PAUSED',
				reverseOrForward = this.props.reverse || progress >= this.state.progress;
			if (this.duration === 0) {
				// zero duration scenes
				doUpdate = this.state.progress !== progress;
				const newProgress = progress < 1 && reverseOrForward ? 0 : 1;
				const newState = this.state.progress === 0 ? SCENE_STATE_BEFORE : SCENE_STATE_DURING;
				console.log('zero duration', newProgress)
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
					console.log('back to initial', newProgress)
					this.setState({
						progress: newProgress,
						state: newState
					})
					doUpdate = true;
				} else if (progress >= 0 && progress < 1 && reverseOrForward) {
					const newProgress = progress;
					const newState = SCENE_STATE_DURING;
					console.log('making progress', newProgress)
					this.setState({
						progress: newProgress,
						state: newState
					})
					doUpdate = true;
				} else if (progress >= 1 && this.state.state !== SCENE_STATE_AFTER) {
					const newProgress = progress = 1;
					const newState = SCENE_STATE_AFTER;
					console.log('after', newProgress)
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

				var emit = (eventName)=>{ // tmp helper to simplify code
					this.emit(eventName, eventVars);
				};

				if (stateChanged) { // enter events
					if (oldState !== SCENE_STATE_DURING) {
						emit("enter");
						emit(oldState === SCENE_STATE_BEFORE ? "start" : "end");
					}
				}
				emit("progress");
				if (stateChanged) { // leave events
					if (this.state.state !== SCENE_STATE_DURING) {
						emit(this.state.state === SCENE_STATE_BEFORE ? "start" : "end");
						emit("leave");
					}
				}
			}
		}
	};
	
	//TODO: REACT, handle function props insead of events
	emit(name, vars) {
		const nameCapped = name.charAt(0).toUpperCase() + name.substring(1);
		const eventFuncName = `on${nameCapped}`; //e.g. start becomes onStart, end becomes onEnd
		const eventFuncMaybe = this.props[eventFuncName];

		//if its a function call it with vars
		Type.Function(eventFuncMaybe) && eventFuncMaybe(vars);
		//emit it, regardless
		this.events.emit(name, vars);
	};

	render(){
		const {children, disabled} = this.props;
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
}
Stage.contextType = DirectorContext;


//TODO: durationUpdateMethod is never used
Stage.defaultProps = {
	disabled: false,
	duration: 0,
	offset: 0,
	triggerRef: null, //TODO: maybe this may not be how we handle the same problem
	triggerHook: 0.5,
	reverse: true,
	loglevel: 2
}

Stage.propTypes = {
	disabled: PropTypes.bool
}