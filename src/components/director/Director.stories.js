import React from 'react';
import Director from './index';
import Stage from '../stage';
import Actor from '../actor';
import Scene from '../scene';
import Assistant from '../assistant';


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