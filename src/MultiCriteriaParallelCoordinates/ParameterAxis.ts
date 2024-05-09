import { DefaultAxis } from "../ParallelCoordinates/DefaultAxis";
import { Dimension } from "../types";

/** Simple axis for values parameters in PAVED
 *  Includes brushing with optional gradient
 */

export class ParameterAxis<T extends Dimension> extends DefaultAxis<T> {
	// Visualization control member variables
	selectionGradientEnabled: boolean;

	constructor(dimension: T) {
		super(dimension);

		this.selectionGradientEnabled = false;
	}

	public setSelectionColor(gradient: boolean): ParameterAxis<T> {
		this.selectionGradientEnabled = gradient;

		return this;
	}

	protected initCanvas(): void {
		super.initCanvas();

		const tooltipGroup = this.axisGroup.append("g").attr("id", "brushed-tooltip");
		tooltipGroup.append("rect");
		tooltipGroup.append("text");
	}

	// Override
	public showTooltip(domainValue: number | string) {
		const tickFormatter = this.scale.getTickFormat();
		const tooltip = this.axisGroup.select("#brushed-tooltip");
		tooltip
			.attr("transform", () => {
				return "translate(-13," + this.scale.domainToRange(domainValue) + ")";
			})
			.style("display", "block");
		tooltip.select("text").text(tickFormatter(domainValue));
		const tooltipNode = tooltip.select("text").node();
		if (tooltipNode !== null) {
			const bbox = (tooltipNode as SVGTextElement).getBBox();
			const horPadding = 6;
			tooltip
				.select("rect")
				.attr("x", bbox.x - horPadding / 2)
				.attr("y", bbox.y)
				.attr("width", bbox.width + horPadding)
				.attr("height", bbox.height);
		}
	}

	public hideTooltip() {
		this.axisGroup.select("#brushed-tooltip").style("display", "none");
	}

	public render() {
		super.render();

		// Update brush color coding
		this.brushGroup
			.select(".selection")
			.datum({ type: "selection" }) // This is necessary, otherwise the brush won't be movable anymore (only via handles)
			.style("fill", () => {
				return this.selectionGradientEnabled ? "url(#gradient)" : "#777";
			})
			.style("fill-opacity", () => {
				return this.selectionGradientEnabled ? 0.3 : 0.2;
			});

		// Move tick labels left
		this.axisGroup.selectAll(".tick text").attr("x", -13);
	}
}
