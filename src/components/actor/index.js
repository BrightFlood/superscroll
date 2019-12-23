import React, {Component} from 'react';
import {StageContext} from '../stage/context';

//Defines a group of components which are affected by scrolling through a scene
export default class Actor extends Component {
	render(){
		return <StageContext.Consumer>
			{value => JSON.stringify(value, null, 4)}
		</StageContext.Consumer>
	}
}