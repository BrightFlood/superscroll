import React, {Component} from 'react';
import {StageContext} from '../stage/context';
import {Util,Get, Type,PIN_SPACER_ATTRIBUTE} from '../../classes/util';

/*
	* ----------------------------------------------------------------
	* settings
	* ----------------------------------------------------------------
	*/

	var
	NAMESPACE = 'SuperScroll.Actor',
	SCENE_STATE_BEFORE = 'BEFORE',
	SCENE_STATE_DURING = 'DURING',
	SCENE_STATE_AFTER = 'AFTER';

//Defines a group of components which are affected by scrolling through a scene
export default class Actor extends Component {
	render(){
		return <StageContext.Consumer>
			{value => JSON.stringify(value, null, 4)}
		</StageContext.Consumer>
	}

	/**
	 * Update the pin state.
	 * @private
	 */
	//TODO: REACT, meaty part of pinning, most likely should moved to the ACTOR or a new PIN component
	updatePinState(forceUnpin) {
		if (this.state.pin && this.state.controller) {
			var 
				containerInfo = this.state.controller.info(),
				pinTarget = this.state.pinOptions.spacer.firstChild; // may be pin element or another spacer, if cascading pins

			if (!forceUnpin && this.state.state === SCENE_STATE_DURING) { // during scene or if duration is 0 and we are past the trigger
				// pinned state
				if (Util.css(pinTarget, "position") !== "fixed") {
					// change state before updating pin spacer (position changes due to fixed collapsing might occur.)
					Util.css(pinTarget, {"position": "fixed"});
					// update pin spacer
					this.updatePinDimensions();
				}

				var
					fixedPos = Get.offset(this.state.pinOptions.spacer, true), // get viewport position of spacer
					scrollDistance = this.state.options.reverse || this.state.options.duration === 0 ?
										containerInfo.scrollPos - this.state.scrollOffset.start // quicker
									: Math.round(this.state.progress * this.state.options.duration * 10)/10; // if no reverse and during pin the position needs to be recalculated using the progress
				
				// add scrollDistance
				fixedPos[containerInfo.vertical ? "top" : "left"] += scrollDistance;

				// set new values
				Util.css(this.state.pinOptions.spacer.firstChild, {
					top: fixedPos.top,
					left: fixedPos.left
				});
			} else {
				// unpinned state
				var
					newCSS = {
						position: this.state.pinOptions.inFlow ? "relative" : "absolute",
						top:  0,
						left: 0
					},
					change = Util.css(pinTarget, "position") !== newCSS.position;
				
				if (!this.state.pinOptions.pushFollowers) {
					newCSS[containerInfo.vertical ? "top" : "left"] = this.state.options.duration * this.state.progress;
				} else if (this.state.options.duration > 0) { // only concerns scenes with duration
					if (this.state.state === SCENE_STATE_AFTER && parseFloat(Util.css(this.state.pinOptions.spacer, "padding-top")) === 0) {
						change = true; // if in after state but havent updated spacer yet (jumped past pin)
					} else if (this.state.state === SCENE_STATE_BEFORE && parseFloat(Util.css(this.state.pinOptions.spacer, "padding-bottom")) === 0) { // before
						change = true; // jumped past fixed state upward direction
					}
				}
				// set new values
				Util.css(pinTarget, newCSS);
				if (change) {
					// update pin spacer if state changed
					this.updatePinDimensions();
				}
			}
		}
	};

	/**
	 * Update the pin spacer and/or element size.
	 * The size of the spacer needs to be updated whenever the duration of the scene changes, if it is to push down following elements.
	 * @private
	 */
	//TODO: REACT, meaty part of pinning, most likely should moved to the ACTOR or a new PIN component
	updatePinDimensions() {
		if (this.state.pin && this.state.controller && this.state.pinOptions.inFlow) { // no spacerresize, if original position is absolute
			var
				after = (this.state.state === SCENE_STATE_AFTER),
				before = (this.state.state === SCENE_STATE_BEFORE),
				during = (this.state.state === SCENE_STATE_DURING),
				vertical = this.state.controller.info("vertical"),
				pinTarget = this.state.pinOptions.spacer.firstChild, // usually the pined element but can also be another spacer (cascaded pins)
				marginCollapse = Util.isMarginCollapseType(Util.css(this.state.pinOptions.spacer, "display")),
				css = {};

			// set new size
			// if relsize: spacer -> pin | else: pin -> spacer
			if (this.state.pinOptions.relSize.width || this.state.pinOptions.relSize.autoFullWidth) {
				if (during) {
					Util.css(this.state.pin, {"width": Get.width(this.state.pinOptions.spacer)});
				} else {
					Util.css(this.state.pin, {"width": "100%"});
				}
			} else {
				// minwidth is needed for cascaded pins.
				css["min-width"] = Get.width(vertical ? this.state.pin : pinTarget, true, true);
				css.width = during ? css["min-width"] : "auto";
			}
			if (this.state.pinOptions.relSize.height) {
				if (during) {
					// the only padding the spacer should ever include is the duration (if pushFollowers = true), so we need to substract that.
					Util.css(this.state.pin, {"height": Get.height(this.state.pinOptions.spacer) - (this.state.pinOptions.pushFollowers ? this.state.options.duration : 0)});
				} else {
					Util.css(this.state.pin, {"height": "100%"});
				}
			} else {
				// margin is only included if it's a cascaded pin to resolve an IE9 bug
				css["min-height"] = Get.height(vertical ? pinTarget : this.state.pin, true , !marginCollapse); // needed for cascading pins
				css.height = during ? css["min-height"] : "auto";
			}

			// add space for duration if pushFollowers is true
			if (this.state.pinOptions.pushFollowers) {
				css["padding" + (vertical ? "Top" : "Left")] = this.state.options.duration * this.state.progress;
				css["padding" + (vertical ? "Bottom" : "Right")] = this.state.options.duration * (1 - this.state.progress);
			}
			Util.css(this.state.pinOptions.spacer, css);
		}
	};

	/**
	 * Updates the Pin state (in certain scenarios)
	 * If the controller container is not the document and we are mid-pin-phase scrolling or resizing the main document can result to wrong pin positions.
	 * So this function is called on resize and scroll of the document.
	 * @private
	 */
	//TODO: REACT, meaty part of pinning, most likely should moved to the ACTOR or a new PIN component
	updatePinInContainer() {
		if (this.state.controller && this.state.pin && this.state.state === SCENE_STATE_DURING && !this.state.controller.info("isDocument")) {
			this.updatePinState();
		}
	};

	/**
	 * Updates the Pin spacer size state (in certain scenarios)
	 * If container is resized during pin and relatively sized the size of the pin might need to be updated...
	 * So this function is called on resize of the container.
	 * @private
	 */
	//TODO: REACT, meaty part of pinning, most likely should moved to the ACTOR or a new PIN component
	updateRelativePinSpacer() {
		if ( this.state.controller && this.state.pin && // well, duh
			this.state.state === SCENE_STATE_DURING && // element in pinned state?
				( // is width or height relatively sized, but not in relation to body? then we need to recalc.
					((this.state.pinOptions.relSize.width || this.state.pinOptions.relSize.autoFullWidth) && Get.width(window) !== Get.width(this.state.pinOptions.spacer.parentNode)) ||
					(this.state.pinOptions.relSize.height && Get.height(window) !== Get.height(this.state.pinOptions.spacer.parentNode))
				)
		) {
			this.updatePinDimensions();
		}
	};

	/**
	 * Is called, when the mousewhel is used while over a pinned element inside a div container.
	 * If the scene is in fixed state scroll events would be counted towards the body. This forwards the event to the scroll container.
	 * @private
	 */
	//TODO: REACT, meaty part of pinning, most likely should moved to the ACTOR or a new PIN component
	onMousewheelOverPin(e) {
		if (this.state.controller && this.state.pin && this.state.state === SCENE_STATE_DURING && !this.state.controller.info("isDocument")) { // in pin state
			e.preventDefault();
			this.state.controller._setScrollPos(this.state.controller.info("scrollPos") - ((e.wheelDelta || e[this.state.controller.info("vertical") ? "wheelDeltaY" : "wheelDeltaX"])/3 || -e.detail*30));
		}
	};

	/**
	 * Pin an element for the duration of the scene.
	 * If the scene duration is 0 the element will only be unpinned, if the user scrolls back past the start position.  
	 * Make sure only one pin is applied to an element at the same time.
	 * An element can be pinned multiple times, but only successively.
	 * _**NOTE:** The option `pushFollowers` has no effect, when the scene duration is 0._
	 * @method ScrollMagic.Scene#setPin
	 * @example
	 * // pin element and push all following elements down by the amount of the pin duration.
	 * scene.setPin("#pin");
	 *
	 * // pin element and keeping all following elements in their place. The pinned element will move past them.
	 * scene.setPin("#pin", {pushFollowers: false});
	 *
	 * @param {(string|object)} element - A Selector targeting an element or a DOM object that is supposed to be pinned.
	 * @param {object} [settings] - settings for the pin
	 * @param {boolean} [settings.pushFollowers=true] - If `true` following elements will be "pushed" down for the duration of the pin, if `false` the pinned element will just scroll past them.  
														Ignored, when duration is `0`.
	* @param {string} [settings.spacerClass="scrollmagic-pin-spacer"] - Classname of the pin spacer element, which is used to replace the element.
	*
	* @returns {Scene} Parent object for chaining.
	*/
	//TODO: REACT, meaty part of pinning, most likely should moved to the ACTOR or a new PIN component
	setPin(element, settings) {
		var
			defaultSettings = {
				pushFollowers: true,
				spacerClass: "scrollmagic-pin-spacer"
			};
		// (BUILD) - REMOVE IN MINIFY - START
		var pushFollowersActivelySet = settings && settings.hasOwnProperty('pushFollowers');
		// (BUILD) - REMOVE IN MINIFY - END
		settings = Util.extend({}, defaultSettings, settings);

		// validate Element
		element = Get.elements(element)[0];
		if (!element) {
			this.log(1, "ERROR calling method 'setPin()': Invalid pin element supplied.");
			return this; // cancel
		} else if (Util.css(element, "position") === "fixed") {
			this.log(1, "ERROR calling method 'setPin()': Pin does not work with elements that are positioned 'fixed'.");
			return this; // cancel
		}

		if (this.state.pin) { // preexisting pin?
			if (this.state.pin === element) {
				// same pin we already have -> do nothing
				return this; // cancel
			} else {
				// kill old pin
				this.removePin();
			}
			
		}
		this.state.pin = element;
		
		var
			parentDisplay = this.state.pin.parentNode.style.display,
			boundsParams = ["top", "left", "bottom", "right", "margin", "marginLeft", "marginRight", "marginTop", "marginBottom"];

			this.state.pin.parentNode.style.display = 'none'; // hack start to force css to return stylesheet values instead of calculated px values.
		var
			inFlow = Util.css(this.state.pin, "position") !== "absolute",
			pinCSS = Util.css(this.state.pin, boundsParams.concat(["display"])),
			sizeCSS = Util.css(this.state.pin, ["width", "height"]);
			this.state.pin.parentNode.style.display = parentDisplay; // hack end.

		if (!inFlow && settings.pushFollowers) {
			this.log(2, "WARNING: If the pinned element is positioned absolutely pushFollowers will be disabled.");
			settings.pushFollowers = false;
		}
		// (BUILD) - REMOVE IN MINIFY - START
		window.setTimeout(function () { // wait until all finished, because with responsive duration it will only be set after scene is added to controller
			if (this.state.pin && this.state.options.duration === 0 && pushFollowersActivelySet && settings.pushFollowers) {
				this.log(2, "WARNING: pushFollowers =", true, "has no effect, when scene duration is 0.");
			}
		}, 0);
		// (BUILD) - REMOVE IN MINIFY - END

		// create spacer and insert
		var
			spacer = this.state.pin.parentNode.insertBefore(document.createElement('div'), this.state.pin),
			spacerCSS = Util.extend(pinCSS, {
					position: inFlow ? "relative" : "absolute",
					boxSizing: "content-box",
					mozBoxSizing: "content-box",
					webkitBoxSizing: "content-box"
				});

		if (!inFlow) { // copy size if positioned absolutely, to work for bottom/right positioned elements.
			Util.extend(spacerCSS, Util.css(this.state.pin, ["width", "height"]));
		}

		Util.css(spacer, spacerCSS);
		spacer.setAttribute(PIN_SPACER_ATTRIBUTE, "");
		Util.addClass(spacer, settings.spacerClass);

		// set the pin Options
		this.state.pinOptions = {
			spacer: spacer,
			relSize: { // save if size is defined using % values. if so, handle spacer resize differently...
				width: sizeCSS.width.slice(-1) === "%",
				height: sizeCSS.height.slice(-1) === "%",
				autoFullWidth: sizeCSS.width === "auto" && inFlow && Util.isMarginCollapseType(pinCSS.display)
			},
			pushFollowers: settings.pushFollowers,
			inFlow: inFlow, // stores if the element takes up space in the document flow
		};
		
		if (!this.state.pin.___origStyle) {
			this.state.pin.___origStyle = {};
			var
				pinInlineCSS = this.state.pin.style,
				copyStyles = boundsParams.concat(["width", "height", "position", "boxSizing", "mozBoxSizing", "webkitBoxSizing"]);
			copyStyles.forEach(function (val) {
				this.state.pin.___origStyle[val] = pinInlineCSS[val] || "";
			});
		}

		// if relative size, transfer it to spacer and make pin calculate it...
		if (this.state.pinOptions.relSize.width) {
			Util.css(spacer, {width: sizeCSS.width});
		}
		if (this.state.pinOptions.relSize.height) {
			Util.css(spacer, {height: sizeCSS.height});
		}

		// now place the pin element inside the spacer	
		spacer.appendChild(this.state.pin);
		// and set new css
		Util.css(this.state.pin, {
			position: inFlow ? "relative" : "absolute",
			margin: "auto",
			top: "auto",
			left: "auto",
			bottom: "auto",
			right: "auto"
		});
		
		if (this.state.pinOptions.relSize.width || this.state.pinOptions.relSize.autoFullWidth) {
			Util.css(this.state.pin, {
				boxSizing : "border-box",
				mozBoxSizing : "border-box",
				webkitBoxSizing : "border-box"
			});
		}

		// add listener to document to update pin position in case controller is not the document.
		window.addEventListener('scroll', this.updatePinInContainer);
		window.addEventListener('resize', this.updatePinInContainer);
		window.addEventListener('resize', this.updateRelativePinSpacer);
		// add mousewheel listener to catch scrolls over fixed elements
		this.state.pin.addEventListener("mousewheel", this.onMousewheelOverPin);
		this.state.pin.addEventListener("DOMMouseScroll", this.onMousewheelOverPin);

		this.log(3, "added pin");

		// finally update the pin to init
		this.updatePinState();

		return this;
	};

	/**
	 * Remove the pin from the scene.
	 * @method ScrollMagic.Scene#removePin
	 * @example
	 * // remove the pin from the scene without resetting it (the spacer is not removed)
	 * scene.removePin();
	 *
	 * // remove the pin from the scene and reset the pin element to its initial position (spacer is removed)
	 * scene.removePin(true);
	 *
	 * @param {boolean} [reset=false] - If `false` the spacer will not be removed and the element's position will not be reset.
	 * @returns {Scene} Parent object for chaining.
	 */
	//TODO: REACT, meaty part of pinning, most likely should moved to the ACTOR or a new PIN component
	//TODO: REACT, this pattern may not make sense in React
	removePin(reset) {
		if (this.state.pin) {
			if (this.state.state === SCENE_STATE_DURING) {
				this.updatePinState(true); // force unpin at position
			}
			if (reset || !this.state.controller) { // if there's no controller no progress was made anyway...
				var pinTarget = this.state.pinOptions.spacer.firstChild; // usually the pin element, but may be another spacer (cascaded pins)...
				if (pinTarget.hasAttribute(PIN_SPACER_ATTRIBUTE)) { // copy margins to child spacer
					var
						style = this.state.pinOptions.spacer.style,
						values = ["margin", "marginLeft", "marginRight", "marginTop", "marginBottom"],
						margins = {};
					values.forEach(function (val) {
						margins[val] = style[val] || "";
					});
					Util.css(pinTarget, margins);
				}
				this.state.pinOptions.spacer.parentNode.insertBefore(pinTarget, this.state.pinOptions.spacer);
				this.state.pinOptions.spacer.parentNode.removeChild(this.state.pinOptions.spacer);
				if (!this.state.pin.parentNode.hasAttribute(PIN_SPACER_ATTRIBUTE)) { // if it's the last pin for this element -> restore inline styles
					// TODO: only correctly set for first pin (when cascading) - how to fix?
					Util.css(this.state.pin, this.state.pin.___origStyle);
					delete this.state.pin.___origStyle;
				}
			}
			window.removeEventListener('scroll', this.updatePinInContainer.bind(this));
			window.removeEventListener('resize', this.updatePinInContainer.bind(this));
			window.removeEventListener('resize', this.updateRelativePinSpacer.bind(this));
			this.state.pin.removeEventListener("mousewheel", this.onMousewheelOverPin.bind(this));
			this.state.pin.removeEventListener("DOMMouseScroll", this.onMousewheelOverPin.bind(this));
			this.state.pin = undefined;
			this.log(3, "removed pin (reset: " + (reset ? "true" : "false") + ")");
		}
		return this;
	};
}