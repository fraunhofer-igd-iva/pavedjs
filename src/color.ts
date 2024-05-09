import { scaleLinear, ScaleLinear, scaleOrdinal, ScaleOrdinal } from "d3-scale";
import { ATTRIBUTE_TYPE, COLOR_CODING, Dimension, Objective, OPTIMIZATION_TYPE } from "./types";
import { color } from "d3-color";

/**
 * The interface representing a color scale.
 * @property {(ScaleLinear | ScaleOrdinal)} scale - The internal D3 scale, linear scale for gradient, ordinal scale for single color.
 * @method {function} getRange - Returns a copy of the scale’s current range.
 * @method {function} calculateColor - Given a value from the domain, the linear scale returns the corresponding color value from the range. The ordinal scale returns the single default color.
 * @interface
 */
interface IColorScale {
	scale: ScaleLinear<string, string> | ScaleOrdinal<string, string>;

	getRange(): Array<string>;
	calculateColor(val?: number): string;
}

class DefaultColorScaleImpl implements IColorScale {
	scale: ScaleOrdinal<string, string>;

	/**
	 * The default color could also be chosen to reflect the primary color of the theme.
	 * */
	constructor() {
		this.scale = scaleOrdinal<string, string>(["#000"]);
	}

	getRange(): Array<string> {
		return this.scale.range();
	}

	calculateColor(): string {
		return this.scale("default");
	}
}

class GradientColorScaleImpl implements IColorScale {
	scale: ScaleLinear<string, string>;

	constructor(domain: [number, number], minimization: boolean) {
		const range = ["green", "red"];
		if (!minimization) range.reverse();
		this.scale = scaleLinear<string, string>().domain(domain).range(range);
	}

	getRange(): Array<string> {
		return this.scale.range();
	}

	calculateColor(val: number): string {
		return this.scale(val);
	}
}

/**
 * The ColorCodingHelper encloses all functionality related to color-coding.
 * @property {boolean} enabled @private - Whether color-coding is enabled.
 * @property {(Dimension | Objective | null)} attribute @private - If applicable, the attribute that the color-coding refers to.
 * @property {COLOR_CODING} type @private - The type that determines whether polylines are rendered with a single color or with a gradient.
 * @property {IColorScale} colorScale @private - The actual mapping of values to color.
 */
export class ColorCodingHelper {
	private enabled: boolean;
	private attribute: Dimension | Objective | null;
	private type: COLOR_CODING;
	private colorScale: IColorScale;

	/** Creates and initializes a new ColorCodingHelper with disabled settings.
	 * @constructor
	 */
	constructor() {
		this.disable();
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	setAttribute(attribute: Dimension | Objective | null): ColorCodingHelper {
		this.attribute = attribute;
		return this;
	}

	getAttribute(): Dimension | Objective | null {
		return this.attribute;
	}

	getType(): COLOR_CODING {
		return this.type;
	}

	getScaleRange() {
		return this.colorScale.getRange();
	}

	enable(): ColorCodingHelper {
		this.enabled = true;

		return this;
	}

	disable(): ColorCodingHelper {
		this.enabled = false;
		this.attribute = null;
		this.type = COLOR_CODING.DEFAULT;
		this.colorScale = new DefaultColorScaleImpl();

		return this;
	}

	setDefaultColorScale(): ColorCodingHelper {
		this.attribute = null;
		this.type = COLOR_CODING.DEFAULT;
		this.colorScale = new DefaultColorScaleImpl();

		return this;
	}

	setGradientColorScale(attribute: Objective): ColorCodingHelper {
		this.attribute = attribute;
		this.type = COLOR_CODING.GRADIENT_BRUSH;
		if (attribute.attr_type === ATTRIBUTE_TYPE.NUMERICAL) {
			const statistics = attribute.statistics as { min: number; max: number };
			this.colorScale = new GradientColorScaleImpl(
				[statistics.min, statistics.max],
				attribute.obj === OPTIMIZATION_TYPE.MIN
			);
		} else throw new Error("PAVEDJS: Cannot set gradient brush: attribute domain is missing!");

		return this;
	}

	/**
	 * @returns {string} - Returns the HEX representation of the corresponding color.
	 */
	calculateColor(val?: number): string {
		const rgbColor = color(this.colorScale.calculateColor(val));
		return rgbColor !== null ? rgbColor.hex() : "#000";
	}
}
