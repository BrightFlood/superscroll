
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
import {StageContext} from '../stage/context';

export default class Stage extends Component {
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
							<span>
								{JSON.stringify(director, null, 4)}
							</span>
							<span>
								{JSON.stringify(stage, null, 4)}
							</span>
						</div>
					)}			
				</StageContext.Consumer>
			)}		
		</DirectorContext.Consumer>
	}
}