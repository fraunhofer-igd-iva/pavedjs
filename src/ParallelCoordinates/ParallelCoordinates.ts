import { drag } from "d3-drag";
import { ScalePoint, scalePoint } from "d3-scale";
import { select, Selection } from "d3-selection";
import { line } from "d3-shape";

import {
	ATTRIBUTE_TYPE,
	BRUSHING_DIRECTION,
	DataRow,
	DataRows,
	Dimension,
	Objective,
	OPTIMIZATION_TYPE,
	PCOptions,
	THEME,
} from "../types";
import { CSS_PREFIX } from "../constants";
import { DefaultAxis } from "./DefaultAxis";
import { hasTypeObjective, prepareData } from "../data";

require("./ParallelCoordinates.css");

/**
 * The class rendering a parallel coordinates visualization.
 * @property {DataRows} data - The data items to be displayed.
 * @property {Array<DimType>} dimensions - The attributes associated with the data items.
 * @property {number} canvasHeight - The height of the canvas available for rendering, i.e., the chart height without top and bottom padding.
 * @property {number} canvasWidth - The width of the canvas available for rendering, i.e., the chart width without left and right padding.
 * @property {Selection<SVGGElement>} chartGroup - The root svg group containing all rendered elements.
 * @property {ScalePoint<string>} xScale - A point scale determining the horizontal positions (equally distributed) of the parallel coordinates axes.
 * @property {{[key: string]: DefaultAxis<Dimension | Objective>}} axes - Store instances of rendered axis for each attribute by attribute name
 * @property {[key: string]: number} dragging - Track drag positions of axes by attribute name for re-ordering via drag and drop
 * @class
 */
export class ParallelCoordinates<DimType extends Dimension> {
	data: DataRows;
	dimensions: Array<DimType>;

	canvasHeight: number;
	canvasWidth: number;
	chartGroup: Selection<SVGGElement, unknown, null, undefined>;
	xScale: ScalePoint<string>;
	axes: { [key: string]: DefaultAxis<Dimension | Objective> };
	dragging: { [key: string]: number };

	/**
	 * Create and initialize a new ParallelCoordinates visualization
	 * @param {HTMLElement} node - The DOM node to which the visualization is attached. Specified as public to make it a member variable.
	 * @param {PCOptions} options - The configuration of the visualization.
	 * @constructor
	 */
	public constructor(
		public node: HTMLElement,
		public options: PCOptions
	) {
		this.initMemberVariables();
		this.initCanvas();
		this.applyTheme();
	}

	protected initMemberVariables() {
		this.dimensions = [];
		this.canvasHeight = this.options.height - this.options.padding.top - this.options.padding.bottom;
		this.canvasWidth = this.options.width - this.options.padding.left - this.options.padding.right;
		this.xScale = scalePoint().range([0, this.canvasWidth]);
		this.axes = {};
		this.dragging = {};
	}

	protected initCanvas() {
		this.node.classList.add(CSS_PREFIX);
		// Init container element
		const container = document.createElement("div");
		container.classList.add(CSS_PREFIX + "-container");
		this.node = this.node.appendChild(container);

		// Init SVG element
		const svg = select(this.node)
			.append<SVGSVGElement>("svg")
			.attr("preserveAspectRatio", "xMidYMid meet")
			.attr("viewBox", "0 0 " + this.options.width + " " + this.options.height)
			.attr("class", "svg-responsive");

		// Init actual canvas
		this.chartGroup = svg
			.append("g")
			.attr("transform", "translate(" + [this.options.padding.left, this.options.padding.top] + ")");
		this.chartGroup.append("g").attr("class", "background");
		this.chartGroup.append("g").attr("class", "foreground");
	}

	// item is needed in overridden method in child class (MultiCriteriaParallelCoordinates.ts)
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	protected polyLineMouseEnter(el: SVGPathElement, item: DataRow): void {
		select(el).classed("focused", true).raise();
	}

	protected polyLineMouseLeave(el: SVGPathElement) {
		select(el).classed("focused", false);
	}

	// el is needed in overridden method in child class (MultiCriteriaParallelCoordinates.ts)
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	protected polyLineClick(el: SVGPathElement) {
		/* Do nothing */
	}

	protected updateAxes(oldDimensions: Array<DimType>) {
		// Update x-scale domain that handles y-scale positioning
		this.xScale.domain(
			this.dimensions.map((dim) => {
				return dim.name;
			})
		);

		// Which dimensions have been present in oldDimensions, but are not present anymore in this.dimensions?
		const toBeRemoved = [
			...oldDimensions.filter((oldDim) => {
				return this.dimensions.map((dim) => dim.name).indexOf(oldDim.name) < 0;
			}),
		];
		// Which dimensions have not been present in oldDimensions, but are now present in this.dimensions?
		const toBeAdded = [
			...this.dimensions.filter((dim) => {
				return oldDimensions.map((oldDim) => oldDim.name).indexOf(dim.name) < 0;
			}),
		];
		// Which dimensions have already been present in oldDimensions and are still present in this.dimensions?
		const toBeModified = [
			...this.dimensions.filter((dim) => {
				return oldDimensions.map((oldDim) => oldDim.name).indexOf(dim.name) >= 0;
			}),
		];

		// Of those to be modified, generate new axes if optimization type (Dimension or Objective) changed
		// CAUTION: only works as long as render has not yet been called
		// Iterate over copy because we are going to remove elements
		const toBeModifiedCopy = structuredClone(toBeModified);
		toBeModifiedCopy.forEach((dim) => {
			const oldDim = oldDimensions.find((oldDim) => oldDim.name === dim.name);
			if (oldDim) {
				if (
					(hasTypeObjective(dim) && !hasTypeObjective(oldDim)) ||
					(!hasTypeObjective(dim) && hasTypeObjective(oldDim))
				) {
					// Attributes have changed significantly, move to toBeRemoved and toBeAdded to trigger new axis generation
					const itemIdx = toBeModified.findIndex((modDim) => modDim.name === dim.name);
					const toBeGenerated = toBeModified.splice(itemIdx, 1)[0];
					toBeRemoved.push(toBeGenerated);
					toBeAdded.push(toBeGenerated);
				}
			}
		});

		// Modify this.axes according to identified axes to be removed/added/modified
		toBeRemoved.forEach((dim) => {
			delete this.axes[dim.name];
		});

		toBeModified.forEach((dim) => {
			// Bind modified dimension to axis and update
			this.axes[dim.name].setDimension(dim);
			this.axes[dim.name].clearBrush();
			this.updateAxis(this.axes[dim.name]);
		});

		toBeAdded.forEach((dim) => {
			const axis = this.generateAxis(dim);

			// Set brush
			axis.setBrushHandler((dim: string, dir?: BRUSHING_DIRECTION) => {
				this.brush(dir);
			});

			this.updateAxis(axis);
		});
	}

	protected generateAxis(dim: Dimension): DefaultAxis<Dimension> {
		return new DefaultAxis(dim);
	}

	protected updateAxis(axis: DefaultAxis<Dimension | Objective>) {
		const dim = axis.getDimension();

		// Set axis scale
		const range: [number, number] = [this.canvasHeight, 0];
		let domain = undefined;
		if (dim.attr_type === ATTRIBUTE_TYPE.NUMERICAL) {
			const statistics = dim.statistics as { min: number; max: number };
			domain = [statistics.min, statistics.max] as [number, number];
		} else if (dim.attr_type === ATTRIBUTE_TYPE.NOMINAL) {
			domain = dim.statistics as Array<string>;
		}
		if (domain !== undefined) axis.setScale(range, domain);

		// Add indicator for invalid values if necessary
		const invalidDimValues = this.data
			.map((item: DataRow) => {
				return item[dim.name];
			})
			.filter((val: string | number) => val === "NaN");
		axis.setNANIndicatorEnabled(invalidDimValues.length > 0);

		this.axes[dim.name] = axis;
	}

	protected isBrushed(node: SVGPathElement): boolean {
		const item = select(node).datum();

		return Object.keys(this.axes)
			.map((key) => this.axes[key])
			.every((axis: DefaultAxis<Dimension | Objective>) => {
				return axis.isBrushed((item as DataRow)[axis.getDimension().name]);
			});
	}

	protected brush(dir?: BRUSHING_DIRECTION) {
		// Load the instance of this class into another variable to use it in anonymous function
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const that = this;
		// Update foreground to only display selected values
		switch (dir) {
			// If brush was extended, we only need to check whether previously non-brushed polylines are now brushed.
			case BRUSHING_DIRECTION.EXTEND:
				this.chartGroup
					.select(".foreground")
					.selectAll<SVGPathElement, DataRow>(".polyline:not(.brushed)")
					.each(function (this: SVGPathElement) {
						const isBrushed = that.isBrushed(this);
						if (isBrushed) {
							const node = select(this).node();
							if (node !== null) node.classList.add("brushed");
						}
					});
				break;
			// If brush was shrinked, we only need to check whether previously brushed values are now non-brushed.
			case BRUSHING_DIRECTION.SHRINK:
				this.chartGroup
					.select(".foreground")
					.selectAll<SVGPathElement, DataRow>(".polyline.brushed")
					.each(function (this: SVGPathElement) {
						const isBrushed = that.isBrushed(this);
						if (!isBrushed) {
							const node = select(this).node();
							if (node !== null) node.classList.remove("brushed");
						}
					});
				break;
			default:
				this.chartGroup
					.select(".foreground")
					.selectAll<SVGPathElement, DataRow>(".polyline")
					.each(function (this: SVGPathElement) {
						const isBrushed = that.isBrushed(this);
						const node = select(this).node();
						if (node !== null) {
							if (isBrushed) node.classList.add("brushed");
							else node.classList.remove("brushed");
						}
					});
		}
	}

	// ---- HELPER FUNCTIONS

	// Compute the current position of the dimension axis
	// This is either mouseX when dim is dragged or position according to xScale when not dragged
	protected position(dim: string): number {
		return Object.keys(this.dragging).includes(dim) ? this.dragging[dim] : this.xScale(dim)!; // Use non-null assertion operator because dim will always be taken from the domain of xScale
	}

	protected specifyLineGenerator() {
		return line()
			.x((d: [number, number]) => d[0])
			.y((d: [number, number]) => d[1]);
	}

	// Returns the path for a given data item.
	protected path(item: DataRow) {
		const lineGenerator = this.specifyLineGenerator();
		const pathPoints = this.dimensions.map((dim) => {
			const dimScale = this.axes[dim.name].getScale();
			const itemValue = item[dim.name];
			const rangeVal = dimScale.domainToRange(itemValue);
			let y;
			if (rangeVal === undefined)
				// Map invalid values to "n.a." circle below the axis
				y = this.canvasHeight + 15;
			else y = rangeVal;
			return [this.position(dim.name), y] as [number, number];
		});
		return lineGenerator(pathPoints);
	}

	// ---- RENDER FUNCTIONS

	protected applyTheme() {
		// Apply theme by replacing class name of container element
		const container: HTMLDivElement | null = document.querySelector("." + CSS_PREFIX + "-container");
		if (container) {
			container.classList.remove(this.options.theme === THEME.LIGHT ? "dark" : "light");
			container.classList.add(this.options.theme === THEME.LIGHT ? "light" : "dark");
		}
	}

	protected renderBackgroundLines() {
		const update = this.chartGroup
			.select(".background")
			.selectAll<SVGPathElement, DataRow>("path")
			.data(this.data, (item) => item["ID"]);

		// Update existing lines
		update.attr("d", (item) => {
			return this.path(item);
		});

		// Add new lines
		update
			.enter()
			.append("path")
			.attr("d", (item) => {
				return this.path(item);
			});

		// Remove surplus of lines
		update.exit().remove();
	}

	protected renderForegroundLines() {
		const update = this.chartGroup
			.select(".foreground")
			.selectAll<SVGPathElement, DataRow>(".polyline")
			.data(this.data, (item) => item["ID"]);

		// Update existing lines
		update.attr("d", (item) => {
			return this.path(item);
		});

		// Load the instance of this class into another variable to use it in anonymous function
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const that = this;
		// New lines
		update
			.enter()
			.append("path")
			.attr("class", "polyline")
			.attr("d", (item) => {
				return this.path(item);
			})
			.on("mouseenter", function (this: SVGPathElement, event: MouseEvent, item) {
				that.polyLineMouseEnter(this, item);
			})
			.on("mouseleave", function (this: SVGPathElement) {
				that.polyLineMouseLeave(this);
			})
			.on("click", function (this: SVGPathElement) {
				that.polyLineClick(this);
			});

		// Remove surplus of lines
		update.exit().remove();
	}

	protected renderAxes() {
		// Load the instance of this class into another variable to use it in anonymous function
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const that = this;

		// Handle a draggable group for each dimension
		const update = this.chartGroup
			.selectAll<SVGGElement, DimType>(".dimension")
			.data(this.dimensions, (dim) => dim.name);

		// Update existing dimension groups
		update
			.attr("class", "dimension")
			.attr("transform", (dim) => {
				return "translate(" + this.xScale(dim.name) + ")";
			})
			.each(function (dim) {
				that.axes[dim.name].render();
			});

		// Set up additional dimension groups
		const newAxisGroups = update
			.enter()
			.append("g")
			.attr("class", "dimension")
			.attr("transform", (dim) => {
				return "translate(" + this.xScale(dim.name) + ")";
			})
			.call(
				drag<SVGGElement, DimType, { x: number | undefined }>()
					.subject((dim: DimType) => {
						return { x: this.xScale(dim.name) };
					})
					.on("start", (event: MouseEvent, dim: DimType) => {
						this.dragging[dim.name] = this.xScale(dim.name)!; // Use non-null assertion operator because dim will always be taken from the domain of xScale
					})
					.on("drag", (event: MouseEvent, dim) => {
						this.dragging[dim.name] = Math.min(this.options.width, Math.max(0, event.x));

						// Update axis' horizontal position
						this.dimensions.sort((dim, other) => {
							return this.position(dim.name) - this.position(other.name);
						});
						this.xScale.domain(this.dimensions.map((dim) => dim.name));
						this.chartGroup.selectAll<SVGGElement, DimType>(".dimension").attr("transform", (dim) => {
							return "translate(" + this.position(dim.name) + ")";
						});

						// Update background and foreground lines
						this.chartGroup
							.select(".background")
							.selectAll<SVGPathElement, DataRow>("path")
							.attr("d", (item) => {
								return this.path(item);
							});
						this.chartGroup
							.select(".foreground")
							.selectAll<SVGPathElement, DataRow>(".polyline")
							.attr("d", (item) => {
								return this.path(item);
							});
					})
					.on("end", (event: MouseEvent, dim) => {
						delete this.dragging[dim.name];

						this.chartGroup
							.select(".background")
							.selectAll<SVGPathElement, DataRow>("path")
							.transition()
							.duration(500)
							.attr("d", (item) => {
								return this.path(item);
							});
						this.chartGroup
							.select(".foreground")
							.selectAll<SVGPathElement, DataRow>(".polyline")
							.transition()
							.duration(500)
							.attr("d", (item) => {
								return this.path(item);
							});

						// Animate update of axis position
						this.xScale.domain(this.dimensions.map((dim) => dim.name));
						this.chartGroup
							.selectAll<SVGGElement, DimType>(".dimension")
							.transition()
							.duration(500)
							.attr("transform", (dim) => {
								return "translate(" + this.position(dim.name) + ")";
							});
					})
					.filter((event: MouseEvent) => {
						return event.target !== null ? (event.target as HTMLElement).tagName === "tspan" : false;
					})
			);

		// Render actual axes into these groups
		newAxisGroups.each(function (dim, i: number, group: SVGGElement[] | ArrayLike<SVGGElement>) {
			select(group[i]).call(that.axes[dim.name].registerAxis);
		});

		update.exit().remove();
	}

	protected render() {
		this.renderBackgroundLines();
		this.renderForegroundLines();
		this.renderAxes();
	}

	// ---- PUBLIC INTERFACES

	public setRows(rows: DataRows) {
		const [columns, modifiedRows] = prepareData(rows);
		this.data = modifiedRows;

		// Dimensions might have changed implicitly
		// Keep additional meta data if column with the same name and attribute type has already been present before
		columns.forEach((col) => {
			const existingDim: Dimension | Objective | undefined = this.dimensions.find(
				(oldDim) => oldDim.name === col.name
			);
			if (existingDim !== undefined) {
				if (col["attr_type"] !== existingDim["attr_type"]) {
					throw new Error(
						"PAVEDJS: setRows must not change an attribute's type from numerical to nominal or vice versa (" +
							col.name +
							")."
					);
				}
				// Extend new dimension by meta data of existing dimension if not present
				if (!("obj" in col) && "obj" in existingDim) {
					(col as Objective)["obj"] = existingDim["obj"] as string | OPTIMIZATION_TYPE;
				}
				if (!("unit" in col) && "unit" in existingDim) {
					col["unit"] = existingDim["unit"];
				}
				if (!("color" in col) && "color" in existingDim) {
					col["color"] = existingDim["color"];
				}
			}
		});

		this.setDimensions(columns as Array<DimType>);

		return this;
	}

	public setDimensions(dimensions: Array<DimType>) {
		const oldDimensions = this.dimensions;
		// Ensure that dimensions are a subset of current row keys
		const isSubset = dimensions.every((dim) => this.data.every((row) => dim.name in row));
		if (isSubset) {
			this.dimensions = dimensions;
			this.updateAxes(oldDimensions);
		} else
			throw new Error("PAVEDJS: Could not set dimensions due to a mismatch between dimensions and data points.");

		return this;
	}

	/**
	 * Can be used to control the visibility of attribute axes
	 * */
	public setDimensionSubset(dimensions: Array<string>) {
		const oldDimensions = this.dimensions;
		const newDims: Array<DimType> = oldDimensions.filter((oldDim) => dimensions.includes(oldDim.name));
		this.setDimensions(newDims);

		return this;
	}

	public setTheme(theme: THEME) {
		this.options.theme = theme;
		// Prepare DOM accordingly (does not re-render)
		this.applyTheme();

		return this;
	}

	// Note: does not need chart.update()
	public clearBrushes() {
		this.dimensions.forEach((dim) => {
			this.axes[dim.name].clearBrush();
		});

		return this;
	}

	public update(data?: DataRows, dimensions?: Array<DimType>) {
		if (data) this.setRows(data);
		if (dimensions) this.setDimensions(dimensions);

		this.render();
		this.brush();
	}
}
