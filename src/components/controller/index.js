import React, { Component } from 'react';
import _util from '../../util';

export class Controller extends Component {
	// store pagewide controller options
 	static CONTROLLER_OPTIONS = {
		defaults: {
			container: window,
			vertical: true,
			globalSceneOptions: {},
			loglevel: 2,
			refreshInterval: 100
		}
	};
	static NAMESPACE = 'ScrollMagic.Controller';
	static SCROLL_DIRECTION_FORWARD = 'FORWARD';
	static SCROLL_DIRECTION_REVERSE = 'REVERSE';
	static SCROLL_DIRECTION_PAUSED = 'PAUSED';
	static DEFAULT_OPTIONS = Controller.CONTROLLER_OPTIONS.defaults;

	constructor(props) {
		super(props);

		this._options = _util.extend({}, Controller.DEFAULT_OPTIONS, props.options);
		// for scenes we have getters for each option, but for the controller we don't, so we need to make it available externally for plugins
		/*
			this._options = _options;
		*/
		this._sceneObjects = [];
		this._updateScenesOnNextCycle = false;		// can be boolean (true => all scenes) or an array of scenes to be updated
		this._scrollPos = 0;
		this._scrollDirection = Controller.SCROLL_DIRECTION_PAUSED;
		this._isDocument = true;
		this._viewPortSize = 0;
		this._enabled = true;
		this._updateTimeout = null;
		this._refreshTimeout = null;
	}

	static addOption(name, defaultValue) {
		Controller.CONTROLLER_OPTIONS.defaults[name] = defaultValue;
	};

	scheduleRefresh() {
		if (this._options.refreshInterval > 0) {
			this._refreshTimeout = window.setTimeout(this.refresh.bind(this), this._options.refreshInterval);
		}
	};

	onChange(e) {
		const {
			SCROLL_DIRECTION_PAUSED
		} = Controller;

		const {
			log,
			_viewPortSize,
			getViewportSize,
			_scrollDirection,
			_updateScenesOnNextCycle,
			debounceUpdate
		} = this;

		log(3, "event fired causing an update:", e.type);
		if (e.type == "resize") {
			// resize
			_viewPortSize = getViewportSize();
			_scrollDirection = SCROLL_DIRECTION_PAUSED;
		}
		// schedule update
		if (_updateScenesOnNextCycle !== true) {
			_updateScenesOnNextCycle = true;
			debounceUpdate();
		}
	};

	refresh() {
		if (!this._isDocument) {
			// simulate resize event. Only works for viewport relevant param (performance)
			if (this._viewPortSize != this.getViewportSize()) {
				var resizeEvent;
				try {
					resizeEvent = new Event('resize', {bubbles: false, cancelable: false});
				} catch (e) { // stupid IE
					resizeEvent = document.createEvent("Event");
					resizeEvent.initEvent("resize", false, false);
				}
				this._options.container.dispatchEvent(resizeEvent);
			}
		}
		this._sceneObjects.forEach(function (scene, index) {// refresh all scenes
			scene.refresh();
		});
		this.scheduleRefresh();
	};

	getScrollPos() {
		const {_options} = this;
		return _options.vertical ? _util.get.scrollTop(_options.container) : _util.get.scrollLeft(_options.container);
	};

	getViewportSize() {
		const {_options} = this;
		return _options.vertical ? _util.get.height(_options.container) : _util.get.width(_options.container);
	};

	setScrollPos(pos) {
		const {_options, _isDocument} = this;
		if (_options.vertical) {
			if (_isDocument) {
				window.scrollTo(_util.get.scrollLeft(), pos);
			} else {
				_options.container.scrollTop = pos;
			}
		} else {
			if (_isDocument) {
				window.scrollTo(pos, _util.get.scrollTop());
			} else {
				_options.container.scrollLeft = pos;
			}
		}
	};

	updateScenes() {
		const {
			SCROLL_DIRECTION_FORWARD,
			SCROLL_DIRECTION_REVERSE
		} = Controller;

		const {
			log,
			_options,
			_enabled,
			_updateScenesOnNextCycle,
			_scrollPos,
			_sceneObjects,
			_scrollDirection,
		} = this;

		if (_enabled && _updateScenesOnNextCycle) {
			// determine scenes to update
			var scenesToUpdate = _util.type.Array(_updateScenesOnNextCycle) ? _updateScenesOnNextCycle : _sceneObjects.slice(0);
			// reset scenes
			_updateScenesOnNextCycle = false;
			var oldScrollPos = _scrollPos;
			// update scroll pos now instead of onChange, as it might have changed since scheduling (i.e. in-browser smooth scroll)
			_scrollPos = Controller.scrollPos();
			var deltaScroll = _scrollPos - oldScrollPos;
			if (deltaScroll !== 0) { // scroll position changed?
				_scrollDirection = (deltaScroll > 0) ? SCROLL_DIRECTION_FORWARD : SCROLL_DIRECTION_REVERSE;
			}
			// reverse order of scenes if scrolling reverse
			if (_scrollDirection === SCROLL_DIRECTION_REVERSE) {
				scenesToUpdate.reverse();
			}
			// update scenes
			scenesToUpdate.forEach(function (scene, index) {
				log(3, "updating Scene " + (index + 1) + "/" + scenesToUpdate.length + " (" + _sceneObjects.length + " total)");
				scene.update(true);
			});
			// (BUILD) - REMOVE IN MINIFY - START
			if (scenesToUpdate.length === 0 && _options.loglevel >= 3) {
				log(3, "updating 0 Scenes (nothing added to controller)");
			}
			// (BUILD) - REMOVE IN MINIFY - END
		}
	};

	debounceUpdate() {
		this._updateTimeout = _util.rAF(this.updateScenes);
	};
	
	log(loglevel, output) {
		const {
			NAMESPACE
		} = Controller;

		const {
			_options
		} = this;

		if (_options.loglevel >= loglevel) {
			Array.prototype.splice.call(arguments, 1, 0, "(" + NAMESPACE + ") ->");
			_util.log.apply(window, arguments);
		}
	};

	// (BUILD) - REMOVE IN MINIFY - END
	
	sortScenes(ScenesArray) {
		if (ScenesArray.length <= 1) {
			return ScenesArray;
		} else {
			var scenes = ScenesArray.slice(0);
			scenes.sort(function(a, b) {
				return a.scrollOffset() > b.scrollOffset() ? 1 : -1;
			});
			return scenes;
		}
	}

	updateScene(Scene, immediately) {
		const {
			_updateScenesOnNextCycle,
		} = this;

		if (_util.type.Array(Scene)) {
			Scene.forEach(function (scene, index) {
				Controller.updateScene(scene, immediately);
			});
		} else {
			if (immediately) {
				Scene.update(true);
			} /* else if (_updateScenesOnNextCycle !== true && Scene instanceof ScrollMagic.Scene) { // if _updateScenesOnNextCycle is true, all connected scenes are already scheduled for update
				// prep array for next update cycle
				_updateScenesOnNextCycle = _updateScenesOnNextCycle || [];
				if (_updateScenesOnNextCycle.indexOf(Scene) == -1) {
					_updateScenesOnNextCycle.push(Scene);	
				}
				_updateScenesOnNextCycle = sortScenes(_updateScenesOnNextCycle); // sort
				debounceUpdate();
			} */
		}
		return Controller;
	};


	update(immediately) {
		this.onChange({type: "resize"}); // will update size and set _updateScenesOnNextCycle to true
		if (immediately) {
			this.updateScenes();
		}
		return Controller;
	};

	scrollTo(scrollTarget, additionalParameter) {
		const {
			PIN_SPACER_ATTRIBUTE
		} = Controller;

		const {
			_options,
			_isDocument,
			setScrollPos,
			log,
		} = this;

		if (_util.type.Number(scrollTarget)) { // excecute
			setScrollPos.call(_options.container, scrollTarget, additionalParameter);
		/*} else if (scrollTarget instanceof ScrollMagic.Scene) { // scroll to scene
			if (scrollTarget.controller() === Controller) { // check if the controller is associated with this scene
				Controller.scrollTo(scrollTarget.scrollOffset(), additionalParameter);
			} else {
				log (2, "scrollTo(): The supplied scene does not belong to this controller. Scroll cancelled.", scrollTarget);
			}
		*/
		} else if (_util.type.Function(scrollTarget)) { // assign new scroll function
			setScrollPos = scrollTarget;
		} else { // scroll to element
			var elem = _util.get.elements(scrollTarget)[0];
			if (elem) {
				// if parent is pin spacer, use spacer position instead so correct start position is returned for pinned elements.
				while (elem.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) {
					elem = elem.parentNode;
				}

				var
					param = _options.vertical ? "top" : "left", // which param is of interest ?
					containerOffset = _util.get.offset(_options.container), // container position is needed because element offset is returned in relation to document, not in relation to container.
					elementOffset = _util.get.offset(elem);

				if (!_isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
					containerOffset[param] -= Controller.scrollPos();
				}

				Controller.scrollTo(elementOffset[param] - containerOffset[param], additionalParameter);
			} else {
				log (2, "scrollTo(): The supplied argument is invalid. Scroll cancelled.", scrollTarget);
			}
		}
		return Controller;
	};

	scrollPos(scrollPosMethod) {
		const {
			getScrollPos,
			log
		} = this;
		if (!arguments.length) { // get
			return getScrollPos.call(Controller);
		} else { // set
			if (_util.type.Function(scrollPosMethod)) {
				getScrollPos = scrollPosMethod;
			} else {
				log(2, "Provided value for method 'scrollPos' is not a function. To change the current scroll position use 'scrollTo()'.");
			}
		}
		return Controller;
	};

	/**
	 * **Get** all infos or one in particular about the controller.
	 * @public
	 * @example
	 * // returns the current scroll position (number)
	 * var scrollPos = controller.info("scrollPos");
	 *
	 * // returns all infos as an object
	 * var infos = controller.info();
	 *
	 * @param {string} [about] - If passed only this info will be returned instead of an object containing all.  
	 							 Valid options are:
	 							 ** `"size"` => the current viewport size of the container
	 							 ** `"vertical"` => true if vertical scrolling, otherwise false
	 							 ** `"scrollPos"` => the current scroll position
	 							 ** `"scrollDirection"` => the last known direction of the scroll
	 							 ** `"container"` => the container element
	 							 ** `"isDocument"` => true if container element is the document.
	 * @returns {(mixed|object)} The requested info(s).
	*/
	info(about) {
		const {
			log,
			_options,
			_isDocument,
			_scrollPos,
			_scrollDirection,
			_viewPortSize
		} = this;

		var values = {
			size: _viewPortSize, // contains height or width (in regard to orientation);
			vertical: _options.vertical,
			scrollPos: _scrollPos,
			scrollDirection: _scrollDirection,
			container: _options.container,
			isDocument: _isDocument
		};
		if (!arguments.length) { // get all as an object
			return values;
		} else if (values[about] !== undefined) {
			return values[about];
		} else {
			log(1, "ERROR: option \"" + about + "\" is not available");
			return;
		}
	};

	loglevel(newLoglevel) {
		const {
			_options,
		} = this;
		// (BUILD) - REMOVE IN MINIFY - START
		if (!arguments.length) { // get
			return _options.loglevel;
		} else if (_options.loglevel != newLoglevel) { // set
			_options.loglevel = newLoglevel;
		}
		// (BUILD) - REMOVE IN MINIFY - END
		return Controller;
	};

	enabled(newState) {
		const {
			_enabled,
			_sceneObjects
		} = this;

		if (!arguments.length) { // get
			return _enabled;
		} else if (_enabled != newState) { // set
			_enabled = !!newState;
			Controller.updateScene(_sceneObjects, true);
		}
		return Controller;
	};

	destroy(resetScenes) {
		const {
			NAMESPACE
		} = Controller;

		const {
			log,
			onChange,
			_options,
			_refreshTimeout,
			_sceneObjects,
			_updateTimeout,
		} = this;
		
		window.clearTimeout(_refreshTimeout);
		var i = _sceneObjects.length;
		while (i--) {
			_sceneObjects[i].destroy(resetScenes);
		}
		_options.container.removeEventListener("resize", onChange);
		_options.container.removeEventListener("scroll", onChange);
		_util.cAF(_updateTimeout);
		log(3, "destroyed " + NAMESPACE + " (reset: " + (resetScenes ? "true" : "false") + ")");
		return null;
	};

	// maybe make the container a special child or just assume this is the container
	// or just default to this being and give option of providing a special container

	componentWillUnmount() {
		//teardown any eventListeners
	}

	render() {
		const {children, container, vertical, globalSceneOptions, loglevel, refreshInterval} = this.props;
		
		const scenes = React.Children.toArray(children)
			.filter(child=>child.type && child.type.name === "Scene")
			.map((child)=>child); // TODO: apply default props where needed
		
		return <div>
			{ scenes }
 	 	</div>
	}
	//scrollTo ???
	//update force update ???
}
