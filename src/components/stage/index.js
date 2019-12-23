
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
import {StageContext} from './context';

//Defines a container which encapsulates Scenes and Actors
export default class Stage extends Component {

	on() {
		
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