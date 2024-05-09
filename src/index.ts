import { OptionalPAVEDOptions, Dimension, OptionalPCOptions, DataRows, DataTable } from "./types";
import { ChartBuilder } from "./ChartBuilder/ChartBuilder";
import { MultiCriteriaParallelCoordinates } from "./MultiCriteriaParallelCoordinates/MultiCriteriaParallelCoordinates";
import { ParallelCoordinates } from "./ParallelCoordinates/ParallelCoordinates";

export { ColorCodingHelper } from "./color";
export {
	DataRows,
	DataTable,
	COLOR_CODING,
	ColorCodingOptions,
	Dimension,
	Objective,
	ATTRIBUTE_TYPE,
	OPTIMIZATION_TYPE,
	THEME,
} from "./types";

/**
 * Create a new builder instance for the given data.
 * @param {(DataRows | DataTable)} data - The items to visualize.
 * @param {(OptionalPAVEDOptions | OptionalPCOptions)} options - The options to customize the visualization.
 * @returns {ChartBuilder}
 */
export function builder(data: DataRows | DataTable, options?: OptionalPAVEDOptions | OptionalPCOptions): ChartBuilder {
	return new ChartBuilder(data, options);
}

/**
 * Build a new PAVED instance in the given node for the given data.
 * @param {HTMLElement} node - The DOM node to attach to.
 * @param {(DataRows | DataTable)} data - The items to visualize.
 * @param {OptionalPAVEDOptions} options - The options to customize the PAVED instance.
 * @returns {MultiCriteriaParallelCoordinates}
 */
export function asPAVED(
	node: HTMLElement,
	data: DataRows | DataTable,
	options?: OptionalPAVEDOptions
): MultiCriteriaParallelCoordinates {
	return builder(data, options).buildPAVED(node);
}

/**
 * Build a new parallel coordinates instance in the given node for the given data.
 * @param {HTMLElement} node - The DOM node to attach to.
 * @param {(DataRows | DataTable)} data - The items to visualize.
 * @param {OptionalPCOptions} options - The options to customize the parallel coordinates instance.
 * @returns {ParallelCoordinates}
 */
export function asParallelCoordinates(
	node: HTMLElement,
	data: DataRows | DataTable,
	options?: OptionalPCOptions
): ParallelCoordinates<Dimension> {
	return builder(data, options).buildParallelCoordinates(node);
}
