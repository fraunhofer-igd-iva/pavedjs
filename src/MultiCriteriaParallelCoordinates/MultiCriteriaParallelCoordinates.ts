import { select, selectAll } from "d3-selection";
import { CurveFactory, curveLinear, curveMonotoneX, line, Line } from "d3-shape";

import {
	ATTRIBUTE_TYPE,
	COLOR_CODING,
	ColorCodingOptions,
	DataRow,
	DataRows,
	Dimension,
	Objective,
	PAVEDOptions,
} from "../types";
import { UNDEFINED_ITEM_ID } from "../constants";
import { ColorCodingHelper } from "../color";
import { hasTypeObjective } from "../data";
import { IBrush, lineBrush } from "./LineBrush";
import { DefaultAxis } from "../ParallelCoordinates/DefaultAxis";
import { ParameterAxis } from "./ParameterAxis";
import { ObjectiveAxis } from "./ObjectiveAxis";
import { ParallelCoordinates } from "../ParallelCoordinates/ParallelCoordinates";

require("./MultiCriteriaParallelCoordinates.css");

/**
 * The class rendering a PAVED visualization.
 * @property {number} lineInFocus - The ID of the data item that is currently hovered or {@link UNDEFINED_ITEM_ID} if no item is currently hovered.
 * @property {Array<number>} flagged - The IDs of the data items that are currently flagged.
 * @property {ColorCodingHelper} colorCoding - An instance of the {@link ColorCodingHelper} to help manage the color-coding.
 * @property {IBrush} lineBrush - An instance of the {@link IBrush} to help manage brushing via the line brush.
 * @property {{ [key: string]: ParameterAxis<(Dimension | Objective)> }} axes - The mapping of attributes to their corresponding axis instances.
 * @class
 */
export class MultiCriteriaParallelCoordinates extends ParallelCoordinates<Dimension | Objective> {
	lineInFocus: number;
	flagged: Array<number>;

	colorCoding: ColorCodingHelper;

	lineBrush: IBrush;

	// Refine type of axes member from DefaultAxis to ParameterAxis to make additional functions accessible
	axes: { [key: string]: ParameterAxis<Dimension | Objective> };

	exposeFlaggedIDs: (ids: Array<number>) => void = () => {};
	exposeHoveredID: (id: number) => void = () => {};

	constructor(
		node: HTMLElement,
		public options: PAVEDOptions
	) {
		super(node, options);

		this.initAdditionalMemberVariables();
		this.initAdditionalCanvasElements();
	}

	protected initAdditionalMemberVariables() {
		this.lineInFocus = UNDEFINED_ITEM_ID;
		this.flagged = [];
		this.colorCoding = new ColorCodingHelper();
	}

	protected initAdditionalCanvasElements() {
		const foreground = this.chartGroup.select<SVGGElement>(".foreground");

		// Init line brush
		this.lineBrush = lineBrush(this.canvasWidth, this.canvasHeight, () => this.brush());
		foreground.call(this.lineBrush);

		// Additional canvas initialization
		foreground
			.append("text")
			.attr("id", "path-label")
			.attr("alignment-baseline", "middle")
			.style("display", "none");

		// Init gradient for single gradient color brush
		this.chartGroup
			.append("linearGradient")
			.attr("id", "gradient")
			//.attr("gradientTransform", "rotate(90)")
			.attr("y1", 0)
			.attr("y2", this.canvasHeight)
			.attr("x1", 0)
			.attr("x2", 0)
			.attr("gradientUnits", "userSpaceOnUse");
	}

	// Override
	protected polyLineMouseEnter(el: SVGPathElement, item: DataRow): void {
		// Bring line to front
		super.polyLineMouseEnter(el, item);

		this.lineInFocus = Number(item.ID);

		// Show line ID
		const rightmostAttribute = this.dimensions[this.dimensions.length - 1];
		select("#path-label")
			.text("ID: " + item.ID)
			.attr("x", () => {
				let rightmostAxisPosition = this.xScale(rightmostAttribute.name);
				if (rightmostAxisPosition === undefined) rightmostAxisPosition = this.canvasWidth;
				return rightmostAxisPosition + 9;
			})
			.attr("y", () => {
				const rightMostAxisScale = this.axes[rightmostAttribute.name].getScale();
				const rightMostDesignValue = item[rightmostAttribute.name];
				const y = rightMostAxisScale.domainToRange(rightMostDesignValue);
				if (y !== undefined) return y;
				else return this.canvasHeight + 15;
			})
			.style("display", "block");

		// Show tooltips on numerical axes
		this.dimensions.forEach((dim: Dimension | Objective) => {
			if (dim.attr_type === ATTRIBUTE_TYPE.NUMERICAL) this.axes[dim.name].showTooltip(item[dim.name]);
		});

		// Notify
		this.exposeHoveredID(this.lineInFocus);
	}

	// Override
	protected polyLineMouseLeave(el: SVGPathElement): void {
		// Bring line to back
		super.polyLineMouseLeave(el);

		this.lineInFocus = UNDEFINED_ITEM_ID;

		// Hide line ID
		select("#path-label").style("display", "none");

		// Keep flagged lines in front by re-raising them
		selectAll<SVGPathElement, DataRow>(".flagged").each(function (this: SVGPathElement) {
			select(this).raise();
		});

		// Hide tooltips
		this.dimensions.forEach((dim: Dimension | Objective) => {
			this.axes[dim.name].hideTooltip();
		});

		// Notify
		this.exposeHoveredID(this.lineInFocus);
	}

	// Override
	protected polyLineClick(el: SVGPathElement): void {
		const elementNode = select(el).node();
		if (elementNode !== null && elementNode.classList.contains("flagged")) this.removeFlag();
		else {
			this.addFlag();
			// Keep flagged lines in front by re-raising them
			selectAll<SVGPathElement, DataRow>(".flagged").each(function (this: SVGPathElement) {
				select(this).raise();
			});
		}

		// Notify
		this.exposeFlaggedIDs(this.flagged);
	}

	// Override
	protected generateAxis(dim: Dimension | Objective): DefaultAxis<Dimension | Objective> {
		return hasTypeObjective(dim) ? new ObjectiveAxis(dim) : new ParameterAxis(dim);
	}

	// Override
	protected updateAxis(axis: DefaultAxis<Dimension | Objective>) {
		// Adds axis to this.axes
		super.updateAxis(axis);

		if (axis instanceof ObjectiveAxis) {
			const dim = axis.getDimension();
			if (dim.color) axis.setColor(dim.color);
		}
	}

	// Override
	protected isBrushed(node: SVGPathElement): boolean {
		const brushedByAxes = super.isBrushed(node);

		const brushedByLine = this.lineBrush ? this.lineBrush.brushed(node) : true;

		return brushedByAxes && brushedByLine;
	}

	// Override
	protected specifyLineGenerator(): Line<[number, number]> {
		let curve: CurveFactory;
		if (this.options.curveSmoothing) curve = curveMonotoneX;
		else curve = curveLinear;

		return line()
			.curve(curve)
			.x((d) => d[0])
			.y((d) => d[1]);
	}

	protected renderForegroundLines() {
		super.renderForegroundLines();

		this.chartGroup
			.select(".foreground")
			.selectAll<SVGPathElement, DataRow>("path.polyline")
			.classed("flagged", (item) => {
				if (this.flagged) return this.flagged.filter((val) => val === item["ID"]).length > 0;
				else return false;
			});

		// Keep flagged lines in front by re-raising them
		this.chartGroup
			.select(".foreground")
			.selectAll<SVGPathElement, DataRow>("path.polyline.flagged")
			.each(function (this: SVGPathElement) {
				select(this).raise();
			});
	}

	protected applyColorCoding() {
		// Remove any prior color coding
		this.removeGradientFromAllAxes();
		this.chartGroup.selectAll<SVGGElement, DataRow>(".foreground .polyline").style("stroke", null);

		// Color coding enabled
		if (this.colorCoding.isEnabled()) {
			// Gradient brush enabled
			if (this.colorCoding.getType() === COLOR_CODING.GRADIENT_BRUSH) {
				this.applyGradientToAxis();
			}

			// Apply color to foreground lines
			this.chartGroup.selectAll<SVGGElement, DataRow>(".foreground .polyline").style("stroke", (item) => {
				const attribute = this.colorCoding.getAttribute();
				if (this.colorCoding.getType() === COLOR_CODING.GRADIENT_BRUSH && attribute !== null)
					return this.colorCoding.calculateColor(Number(item[attribute.name]));
				// Default color scale
				else return this.colorCoding.calculateColor();
			});
		}
	}

	protected applyGradientToAxis() {
		const gradient = this.chartGroup.select("#gradient");
		// Update gradient
		gradient.selectAll("stop").remove();
		const range = this.colorCoding.getScaleRange();
		if (range.length < 1) throw new RangeError("PAVEDJS: Gradient cannot be applied with empty range!");
		gradient
			.append("stop")
			.attr("offset", 0)
			.attr("stop-color", range[range.length - 1]);
		gradient.append("stop").attr("offset", 1).attr("stop-color", range[0]);

		// Apply gradient to axis
		const objective = this.colorCoding.getAttribute();
		if (objective !== null) this.axes[objective.name].setSelectionColor(true);
	}

	protected removeGradientFromAllAxes() {
		this.dimensions.forEach((dim: Dimension | Objective) => {
			this.axes[dim.name].setSelectionColor(false);
		});
	}

	protected addFlag() {
		this.flagged.push(this.lineInFocus);
		this.renderForegroundLines();
	}

	protected removeFlag() {
		const idx = this.flagged.indexOf(this.lineInFocus);
		if (idx > -1) this.flagged.splice(idx, 1);
		this.renderForegroundLines();
	}

	protected isFlagged() {
		return this.flagged.filter((val) => val === this.lineInFocus).length > 0;
	}

	// ---- PUBLIC INTERFACES

	public setFlaggedIDs(ids: Array<number>) {
		this.flagged = ids;

		return this;
	}

	public enableColorCoding(options: ColorCodingOptions) {
		this.colorCoding.enable();
		// Gradient type provided
		if (options.type === COLOR_CODING.GRADIENT_BRUSH) {
			let attr;
			// If valid attribute of type Objective has been provided, set gradient color coding
			if (
				options.attribute !== undefined &&
				(attr = this.dimensions
					.filter((dim) => hasTypeObjective(dim))
					.find((dim) => dim.name === options.attribute)) !== undefined
			) {
				// attr is a valid Objective at this point
				this.colorCoding.setGradientColorScale(attr as Objective);
			} else {
				console.warn("PAVEDJS: Attribute for gradient brush invalid. Falling back to default color-coding...");
				this.colorCoding.setDefaultColorScale();
			}
		}
		// Default type provided
		else this.colorCoding.setDefaultColorScale();

		return this;
	}

	public disableColorCoding() {
		this.colorCoding.disable();

		return this;
	}

	public setCurveSmoothing(enable: boolean) {
		this.options.curveSmoothing = enable;

		return this;
	}

	public setHoveredIDChangeHandler(handler: (id: number) => void) {
		this.exposeHoveredID = handler;

		return this;
	}

	public setFlaggedIDsChangeHandler(handler: (ids: Array<number>) => void) {
		this.exposeFlaggedIDs = handler;

		return this;
	}

	// Override
	public update(data?: DataRows, dimensions?: Array<Dimension | Objective>) {
		this.applyColorCoding();

		super.update(data, dimensions);
	}
}
