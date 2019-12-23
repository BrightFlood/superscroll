import React from 'react';
import Director from './index';
import Stage from '../stage';
import Actor from '../actor';
import Scene from '../scene';
import Assistant from '../assistant';

/*Primary goals for this project:
	1. Works with React Router
		a. Will scroll to a route
	2. Works with React Transition Groups
	3. Ideally you can do all the same kinds of things as the examples on ScrollMagic's site
		b. I'm not immediately concerned about plugins and non-React library compatibility
*/

export default {
  title: 'Director',
};

export const director = () => (
<Director>
	<Assistant location='topleft'/>
	<Stage>
		<Assistant location='topright'/>
		<Scene />
		<Scene />
		<Scene />
		<Actor>
		</Actor>
		<Actor>
		</Actor>
		<Actor>
		</Actor>
		<Stage>
		<Assistant location='bottomleft'/>
			<Scene />
			<Scene />
			<Actor>
			</Actor>
			<Actor>
			</Actor>
			<Actor>
			</Actor>
		</Stage>
	</Stage>
	<div style={{height: 1000}}>
	</div>
</Director>)