import {
	DataColumn,
	DataColumns,
	DataRows,
	DataTable,
	Dimension,
	Objective,
	OPTIMIZATION_TYPE,
	OptionalPAVEDOptions,
	OptionalPCOptions,
	PAVEDOptions,
} from "../types";
import { DefaultOptions } from "../constants";
import { MultiCriteriaParallelCoordinates } from "../MultiCriteriaParallelCoordinates/MultiCriteriaParallelCoordinates";
import { ParallelCoordinates } from "../ParallelCoordinates/ParallelCoordinates";
import { hasTypeDataRows, hasTypeDataTable, hasTypeObjective, prepareData } from "../data";

/** The ChartBuilder helps instantiate the visualizations using the builder design pattern.
 * Once the chart is created, further settings are modified directly on the chart.
 * @property {DataRows} rows @private @readonly
 * @property {DataColumns} columns @private @readonly
 * @property {PAVEDOptions} options @private @readonly
 * */
export class ChartBuilder {
	private readonly rows: DataRows = [];
	private readonly columns: DataColumns = [];
	private readonly options: PAVEDOptions;

	/** Creates and initializes a new ChartBuilder.
	 * @constructor
	 * */
	constructor(
		private data: DataRows | DataTable,
		options?: OptionalPAVEDOptions | OptionalPCOptions
	) {
		this.options = { ...DefaultOptions, ...options };
		const rows = hasTypeDataRows(data) ? data : data.rows;
		const [columns, modifiedRows] = prepareData(rows);
		this.rows = modifiedRows;
		this.columns = columns;

		// Add additional meta data (e.g., optimization type, unit, ...) provided by user as part of the data set
		if (hasTypeDataTable(data)) this.addColumnMetaDataFromUserInput(data.columns);
	}

	/**
	 * Add optional meta data about columns if present in the dataset.
	 * @param {DataColumns} columns - The list of column objects containing the column meta data.
	 * @private
	 * @throws Error if data set contains unknown optimization type.
	 */
	private addColumnMetaDataFromUserInput(columns: DataColumns) {
		const dirs: Record<string, OPTIMIZATION_TYPE> = {};
		const units: Record<string, string> = {};

		columns.forEach((col: DataColumn) => {
			if ("obj" in col && col.obj !== "NONE") {
				// Consider "NONE" objectives as design parameters
				if (col.obj === "MAX") dirs[col.name] = OPTIMIZATION_TYPE.MAX;
				else if (col.obj === "MIN") dirs[col.name] = OPTIMIZATION_TYPE.MIN;
				else
					console.warn(
						"PAVEDJS: Did not add optimization type for " + col.name + ". Unknown optimization type."
					);
			}

			if (col.unit !== undefined) {
				units[col.name] = col.unit;
			}
		});

		if (Object.keys(dirs).length !== 0) this.registerOptimizationDirections(dirs);
		if (Object.keys(units).length !== 0) this.registerUnits(units);
	}

	/**
	 * Register optimization directions as meta data for columns.
	 * @param {Record<string, OPTIMIZATION_TYPE>} dirs - The mapping between column names and optimization types.
	 * @returns {ChartBuilder}
	 * @throws Warning if no column with the specified name exists in the data set.
	 */
	registerOptimizationDirections(dirs: Record<string, OPTIMIZATION_TYPE>): ChartBuilder {
		for (const col in dirs) {
			const matchCol: Dimension | undefined = this.columns.find((column) => column.name === col);
			if (matchCol)
				// By adding obj property, the column is converted from Dimension to Objective type
				(matchCol as Objective)["obj"] = dirs[col];
			else
				console.warn(
					"PAVEDJS: Did not register optimization type for " +
						col +
						". Could not find a column with this name."
				);
		}

		return this;
	}

	/**
	 * Register units as meta data for columns.
	 * @param {Record<string, string>} units - The mapping between column names and units.
	 * @returns {ChartBuilder}
	 * @throws Warning if no column with the specified name exists in the data set.
	 */
	registerUnits(units: Record<string, string>): ChartBuilder {
		for (const col in units) {
			const matchCol: Dimension | Objective | undefined = this.columns.find((column) => column.name === col);
			if (matchCol) matchCol["unit"] = units[col];
			else
				console.warn("PAVEDJS: Did not register unit for " + col + ". Could not find a column with this name.");
		}

		return this;
	}

	/**
	 * Register colors as meta data for columns.
	 * @param {Record<string, string>} colors - The mapping between column names and colors.
	 * @returns {ChartBuilder}
	 */
	registerHEXColors(colors: Record<string, string>): ChartBuilder {
		for (const col in colors) {
			const matchCol: Dimension | Objective | undefined = this.columns.find((column) => column.name === col);
			if (matchCol) {
				if (hasTypeObjective(matchCol)) matchCol["color"] = colors[col];
				else console.warn("PAVEDJS: Did not register color for " + col + ". This column is not an Objective.");
			} else
				console.warn(
					"PAVEDJS: Did not register color for " + col + ". Could not find a column with this name."
				);
		}

		return this;
	}

	/**
	 * Build PAVED at the given parent DOM node.
	 * @param {HTMLElement} node - The parent DOM node to which PAVED is attached.
	 * @returns {MultiCriteriaParallelCoordinates}
	 */
	buildPAVED(node: HTMLElement): MultiCriteriaParallelCoordinates {
		const chart = new MultiCriteriaParallelCoordinates(node, this.options);
		chart.update(this.rows, this.columns);
		return chart;
	}

	/**
	 * Build parallel coordinates visualization at the given parent DOM node.
	 * @param {HTMLElement} node Parent DOM node to attach
	 * @returns {ParallelCoordinates}
	 */
	buildParallelCoordinates(node: HTMLElement): ParallelCoordinates<Dimension> {
		const chart = new ParallelCoordinates(node, this.options);
		if (this.columns.some((col: DataColumn) => "obj" in col))
			console.warn(
				"PAVEDJS: Optimization direction metadata not supported by Parallel Coordinates. Ignoring metadata..."
			);
		if (this.columns.some((col: DataColumn) => "color" in col))
			console.warn(
				"PAVEDJS: Objective color metadata not supported by Parallel Coordinates. Ignoring metadata..."
			);
		chart.update(this.rows, this.columns);
		return chart;
	}
}
