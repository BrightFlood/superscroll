
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
	NAMESPACE = 'SuperScroll.Stage';

export default class Stage extends Component {
	constructor(props) {
		super(props);
		this.state = {
			lastUpdate: null,
			progress: 0,
			scenes: {},
		};

		this.events = new EventEmitter();
	}

	componentDidMount() {
		const context = this.context;
		if(context && context.events) {
			context.events.on('update', ()=>{
				const stateUpdate = {lastUpdate: this.context.lastUpdate};
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
		const contextBody = {
			director: this.context,
			events: this.context.events,
			lastUpdate: this.state.lastUpdate,
			disabled: this.isDisabled,
			duration: this.duration,
			offset: this.props.offset,
			scrollOffset: this.scrollOffset,
			triggerRef: this.props.triggerRef? "true": "false",
			triggerHook: this.props.triggerHook,
			sceneList: this.state.scenes,
			scenes: (scene)=> {
				if(this.state.scenes[scene]) {
					return this.state.scenes[scene];
				} else {
					return {};
				}
			},
			updateScene: (name, reason, status)=> {
				console.log(name,reason,status)
				this.setState((currentState)=>{
					currentState.scenes[name] = status;
					return currentState;
				},()=> console.log(name, status, this.state.scenes));
			}
		}
		contextBody.toString = ()=>{
			const safeCopy = {...contextBody};
			delete safeCopy['director'];
			delete safeCopy['events'];
			return JSON.stringify(safeCopy, null, 4);
		}
		return contextBody;
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