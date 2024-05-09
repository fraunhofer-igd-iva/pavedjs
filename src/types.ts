import { ColorCodingHelper } from "./color";

/**
 * The theme that determines whether the visualization is rendered in light or dark mode.
 * @enum
 */
export enum THEME {
	LIGHT,
	DARK,
}

/**
 * The attribute type to specify whether an attribute is nominal (e.g., categories with no inherent order) or numerical.
 * @enum
 */
export enum ATTRIBUTE_TYPE {
	NOMINAL,
	NUMERICAL,
}

/**
 * The optimization direction associated with a decision criterion, i.e., whether higher or lower values are preferred.
 * @enum
 */
export enum OPTIMIZATION_TYPE {
	MIN,
	MAX,
}

/**
 * The brushing direction describing the modification of a brush upon interaction, e.g., whether the selection has become larger or smaller.
 * Used for optimized computation of brushed values.
 * If the brush was extended, we only need to check whether previously non-brushed values are now brushed, and vice versa.
 * @enum
 */
export enum BRUSHING_DIRECTION {
	EXTEND,
	SHRINK,
}

/**
 * The color-coding that determines whether polylines are rendered with a single color or with a gradient.
 * @enum
 */
export enum COLOR_CODING {
	DEFAULT,
	GRADIENT_BRUSH,
}

/**
 * The type describing a standard attribute.
 * @property {string} name - The attribute name.
 * @property {string} [unit] - The unit associated with the attribute's values.
 * @property {ATTRIBUTE_TYPE} attr_type - The attribute type, i.e., nominal or numerical.
 * @property {string} [color] - The hex color associated with the attribute, used for rendering.
 * @property {(Array<string> | { min: number, max: number })} statistics - The min/max values (for numerical attributes) or unique categorical values (for nominal attributes) as found in the data set.
 * @interface
 */
export type Dimension = {
	name: string;
	unit?: string;
	// computed
	attr_type: ATTRIBUTE_TYPE;
	color?: string;
	statistics: Array<string> | { min: number; max: number };
};
/**
 * The type describing a reduced representation of a {@link Dimension}, e.g., prior to computation of attribute properties.
 * @property name - The attribute name.
 * @interface
 */
export type DimensionPreview = Pick<Dimension, "name">;
/**
 * The type describing a decision criterion as an extension of a {@link Dimension}.
 * @property {(string | OPTIMIZATION_TYPE)} obj - The optimization direction of the criterion, i.e., whether its values should be minimized or maximized.
 * @interface
 */
export type Objective = Dimension & { obj: string | OPTIMIZATION_TYPE };

/**
 * The type describing a data item.
 * @property {number} ID - The unique identifier of the data item.
 * @property {(string | number)} key - A property with respective value for each attribute. Each data item should have the same properties.
 * @interface
 */
export type DataRow = {
	ID: number;
	[key: string]: string | number;
};
/**
 * The type describing a data set as a list of data items.
 * @interface
 */
export type DataRows = Array<DataRow>;
/**
 * The union type representing either an attribute or a criterion.
 * @interface
 */
export type DataColumn = Dimension | Objective;
/**
 * The type describing a list of attributes and criteria.
 * @interface
 */
export type DataColumns = Array<DataColumn>;
/**
 * The type describing a data set as a table with rows and columns.
 * @property {DataColumns} columns - The attributes and criteria with their properties.
 * @property {DataRows} rows - The data items with values for each of the attributes/criteria.
 * @interface
 */
export type DataTable = {
	columns: DataColumns;
	rows: DataRows;
};

/**
 * The interface specifying the general options to customize a {@link ParallelCoordinates} visualization.
 * @property {THEME} theme - Whether the visualization should be rendered in dark or light mode.
 * @property {number} width - The target width of the SVG containing the visualization. Will be scaled up or down responsively while maintaining the aspect ratio.
 * @property {number} height - The target height of the SVG containing the visualization. Will be scaled up or down responsively while maintaining the aspect ratio.
 * @property {object} padding - The padding determining the actual canvas into which the visualization will be rendered.
 * @interface
 */
export interface PCOptions {
	theme: THEME;
	width: number;
	height: number;
	padding: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
}
/**
 * The type rendering all {@link PCOptions} optional.
 * Allows different combinations of options (or none at all) when creating instances of a {@link ParallelCoordinates} visualization.
 * Also enables the use of {@link DefaultOptions}.
 * @interface
 */
export type OptionalPCOptions = Partial<PCOptions>;

/**
 * The interface specifying customization options only available for {@link MultiCriteriaParallelCoordinates} visualizations.
 * @property {ColorCodingHelper} colorCoding - The color-coding to apply.
 * @property {boolean} curveSmoothing - Whether or not data items are rendered as Bezier curves rather than polylines.
 * @interface
 */
export interface PAVEDOptions extends PCOptions {
	colorCoding: ColorCodingHelper;
	curveSmoothing: boolean;
}
/**
 * The type rendering all {@link PAVEDOptions} optional.
 * Allows different combinations of options (or none at all) when creating instances of a {@link MultiCriteriaParallelCoordinates} visualization.
 * Also enables the use of {@link DefaultOptions}.
 * @interface
 */
export type OptionalPAVEDOptions = Partial<PAVEDOptions>;

/**
 * The interface specifying the options to customize the color-coding.
 * @property {COLOR_CODING} type - Whether the color-coding uses a single color or a gradient brush.
 * @property [string] attribute - The name of the attribute whose values determine the colors.
 * @interface
 */
export interface ColorCodingOptions {
	type: COLOR_CODING;
	attribute?: string;
}
