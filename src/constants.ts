import { ColorCodingHelper } from "./color";
import { PAVEDOptions, THEME } from "./types";

/**
 * The prefix appended to the parent container to restrict CSS effects to the scope of this library.
 * @constant
 */
export const CSS_PREFIX = "paved";

/**
 * The number representing an undefined item where item IDs are assigned otherwise.
 * @constant
 */
export const UNDEFINED_ITEM_ID = -2;

/**
 * The default options used to initialize a visualization instance.
 * @constant
 */
export const DefaultOptions: PAVEDOptions = {
	theme: THEME.LIGHT,
	width: 1100,
	height: 600,
	padding: {
		top: 25,
		right: 45,
		bottom: 60,
		left: 65,
	},
	colorCoding: new ColorCodingHelper(),
	curveSmoothing: false,
};
