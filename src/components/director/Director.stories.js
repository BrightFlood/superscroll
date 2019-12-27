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

	//TODO each scene should get its own settings but they should override defaults in the stage
	render() {
		console.log(this.state.ref);
		return <Director>
			<Assistant location='topleft'/>
			<Stage triggerRef={this.state.ref}>
				<Assistant location='topright'/>
				<Indicator name="test1" location='right' offset={0}/>
				<Indicator name="test2" location='right' offset={150}/>
				<Indicator name="test3" location='right' offset={300}/>
				<Scene name="test1" triggerRef={this.state.ref} duration={{percent: 25}} />
				<Scene name="test2" triggerRef={this.state.ref} duration={{percent: 50}} />
				<Scene name="test3" duration={{percent: 50}} />
				<StageContext.Consumer>
					{
						stage => {
							return <div style={{height: 1000, backgroundColor: 'pink', opacity: 1 - stage.scenes('test3').progress}}>
							</div>
						}
					}
				</StageContext.Consumer>
				<StageContext.Consumer>
					{
						stage => {
							return <div style={{height: 1000, backgroundColor: 'lightblue', opacity: stage.scenes('test2').progress}} ref={this.innerRef}>
							</div>
						}
					}
				</StageContext.Consumer>
			</Stage>
		</Director>
	}
}