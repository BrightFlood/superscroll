
import React, {Component} from 'react';
import {DirectorContext} from '../director/context';
import {StageContext} from '../stage/context';

export default class Indicator extends Component {
	render(){
		const {location, offset} = this.props;
		let off = offset || 0;
		off += 20;
		let loc = {right: off};
		switch (location) {
			case 'left':
				loc = {left: off};
				break;
			case 'right':
				loc = {right: off};
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
								zIndex: 20,
								width: '100vw',
								height: '100vh',
							}}
						>
							<span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								color: 'blue'
							}}>{this.props.name}</span>
							<span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								borderTop: "1px solid blue",
								top: director.size * stage.triggerHook,
								color: 'blue'
							}}>{director.scrollDirection} {stage.state}</span>
							<span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								borderTop: "1px solid blue",
								top: director.size * stage.triggerHook,
								color: 'blue'
							}}>{director.scrollDirection} {stage.state}</span>
							{stage.scenes && stage.scenes(this.props.name) && <span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								borderTop: "1px solid green",
								top: director.size * stage.triggerHook + stage.scenes(this.props.name).start - director.scrollPos,
								color: 'green'
							}}>START</span>}
							{stage.scenes && stage.scenes(this.props.name) && <span style={{
								...loc,
								position: 'fixed',
								padding: 0,
								margin: 0,
								borderTop: "1px solid red",
								top: director.size * stage.triggerHook + stage.scenes(this.props.name).end - director.scrollPos,
								color: 'red'
							}}>END</span>}
						</div>
					)}			
				</StageContext.Consumer>
			)}		
		</DirectorContext.Consumer>
	}
}