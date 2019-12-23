import React from 'react';
import ReactDOM from 'react-dom';
import Controller from './components/controller';
import Scene from './components/scene';

/*Primary goals for this project:
	1. Works with React Router
		a. Will scroll to a route
	2. Works with React Transition Groups
	3. Ideally you can do all the same kinds of things as the examples on ScrollMagic's site
		b. I'm not immediately concerned about plugins and non-React library compatibility
*/

ReactDOM.render(<Controller>
	<Scene />
</Controller>, document.getElementById('root'));