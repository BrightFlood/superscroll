
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
import {StageContext} from '../stage/context';

export default class Indicator extends Component {
	render(){
		const {location} = this.props;
		let loc = {right: 20};
		switch (location) {
			case 'left':
				loc = {left: 20};
				break;
			case 'right':
				loc = {right: 20};
				break;
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
								position: 'absolute',
								padding: 0,
								margin: 0,
								width: '100vw',
								height: '100vh',
							}}
						>
							<span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								borderTop: "1px solid blue",
								top: director.size * stage.triggerHook,
								color: 'blue'
							}}>hook</span>
							<span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								borderTop: "1px solid green",
								top: director.size * stage.triggerHook + stage.scrollOffset.start - director.scrollPos,
								color: 'green'
							}}>start</span>
							<span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								borderTop: "1px solid red",
								top: director.size * stage.triggerHook + stage.scrollOffset.end - director.scrollPos,
								color: 'red'
							}}>end</span>
						</div>
					)}			
				</StageContext.Consumer>
			)}		
		</DirectorContext.Consumer>
	}
}