import React from 'react';
import ReactDOM from 'react-dom';
import { Controller } from './components/controller';
import { Scene } from './components/scene';

//export { Controller, Scene };

ReactDOM.render(<Controller>
	<Scene />
</Controller>, document.getElementById('root'));