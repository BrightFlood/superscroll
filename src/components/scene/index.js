import React, {Component} from 'react';
import {StageContext} from '../stage/context';

//Defines trigger regions on Stages
export default class Scene extends Component {
	render(){
		return <StageContext.Consumer>
			{value => <p>{JSON.stringify(value, null, 4)}</p>}
		</StageContext.Consumer>
	}
}