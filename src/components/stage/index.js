
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
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
			progress: 0,
			scrollOffset: {start: 0, end: 0}, // reflects the controllers's scroll position for the start and end of the scene respectively
			triggerPos: 0,
			enabled: true,
			durationUpdateMethod: {},
			controller: {},
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

		// add getters/setters for all possible options
		for (var optionName in DEFAULT_OPTIONS) {
			this.addSceneOption(optionName);
		}

		// validate all options
		this.validateOption();

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
		.on("destroy.internal", (e)=>{
			this.removeClassToggle(e.reset);
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
		if (this.state.options.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			Util.log.apply(window, arguments);
		}
	};
	// (BUILD) - REMOVE IN MINIFY - END

	on() {
		return this;	
	}
	
	off() {

	}

	trigger() {

	}

	addTo() {

	}

	enabled() {

	}

	remove() {

	}

	destroy() {

	}

	update() {

	}

	refresh() {

	}

	progress() {

	}

	setClassToggle(){

	}

	removeClassToggle(){

	}

	updatePinState(){

	}

	updatePinDimensions(){

	}

	updatePinInContainer(){

	}

	updateRelativePinSpacer(){

	}

	onMousewheelOverPin() {

	}

	setPin() {

	}

	removePin() {

	}

	validate() {

	}

	validateOption() {

	}

	changeOption() {

	}

	addSceneOption() {

	}

	controller() {

	}

	sceneState() {

	}

	scrollOffset() {

	}

	triggerPosition() {

	}

	updateScrollOffset() {

	}

	updateDuration() {

	}

	updateTriggerElementPosition() {

	}

	onContainerResize() {
		
	}

	render(){
		return <DirectorContext.Consumer>
			{director=> (
				<StageContext.Consumer>
					{stage=> (
						<StageContext.Provider value={{director, stage: stage && stage.stage ? stage.stage + 1 : 1}}>
							<div>{this.props.children}</div>
						</StageContext.Provider>
					)}			
				</StageContext.Consumer>
			)}		
		</DirectorContext.Consumer>
	}
}