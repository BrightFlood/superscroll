
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
import {StageContext} from '../stage/context';

export default class Assistant extends Component {
	render(){
		const {location} = this.props;
		let loc = {top: 20, left: 20};
		switch (location) {
			case 'bottomleft':
				loc = {bottom: 20, left: 20};
				break;
			case 'bottomright':
				loc = {bottom: 20, right: 20};
				break;
			case 'topright':
				loc = {top: 20, right: 20};
				break;
			case 'topleft':
			default:
				break;
		}
		return <DirectorContext.Consumer>
			{director=> (
				<StageContext.Consumer>
					{stage=> (
						<div
							style={{
								...loc,
								position: 'fixed',
								width: 200,
								height: 200,
								backgroundColor: 'lightgray'
							}}
						>
							<h4 style={{padding: 0, margin: 0}}>Director</h4>
							{
								director && Object.keys(JSON.parse(director.toString())).map((key)=>(<p style={{padding: 0, margin: 0}} key={key}>
	{key}: {JSON.stringify(director[key])}
								</p>))
							}
							<h4>Stage</h4>
							{
								stage && Object.keys(stage).map((key)=>(<p style={{padding: 0, margin: 0}} key={key}>
	{key}: {JSON.stringify(stage[key])}
								</p>))
							}
						</div>
					)}			
				</StageContext.Consumer>
			)}		
		</DirectorContext.Consumer>
	}
}