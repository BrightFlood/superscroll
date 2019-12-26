import React, {Component} from 'react';
import Director from './index';
import Stage from '../stage';
import {StageContext} from '../stage/context';
import Actor from '../actor';
import Scene from '../scene';
import Assistant from '../assistant';
import Indicator from '../indicator';


export default {
  title: 'Director',
};

export const basic = () => (
<Director>
	<Assistant location='topleft'/>
	<Stage offset={100} duration={100}>
		<Assistant location='topright'/>
	</Stage>
	<div style={{height: 1000}}>
	</div>
</Director>)

export const withRef = ()=><RefTest />


class RefTest extends Component {
	constructor(){
		super()
		this.innerRef = React.createRef();
		this.state = {
			ref: null
		}
	}

	componentDidMount() {
		console.log(this.innerRef);
		if(this.innerRef.current) {
			this.setState({ref: this.innerRef.current})
		}
	}

	render() {
		console.log(this.state.ref);
		return <Director>
			<Assistant location='topleft'/>
			<Stage triggerRef={this.state.ref} duration={{percent: 50}}>
				<Assistant location='topright'/>
				<Indicator />
				<div style={{height: 1000, backgroundColor: 'pink'}}>
				</div>
				<StageContext.Consumer>
					{
						stage => {
							return <div style={{height: 1000, backgroundColor: 'lightblue', opacity: stage.progress}} ref={this.innerRef}>
							</div>
						}
					}
				</StageContext.Consumer>
			</Stage>
		</Director>
	}
}