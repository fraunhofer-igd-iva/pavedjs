import { axisLeft } from "d3-axis";
import { BrushBehavior, brushSelection, brushY } from "d3-brush";
import { Selection } from "d3-selection";
import { ATTRIBUTE_TYPE, BRUSHING_DIRECTION, Dimension } from "../types";
import { IAxisScale, NominalAxisScaleImpl, NumericalAxisScaleImpl } from "../scale";

/** Simple axis for parallel coordinates like in D3.js examples
 *  Includes brushing
 */

export class DefaultAxis<DimType extends Dimension> {
	// General member variables
	dimension: DimType;
	scale: IAxisScale;
	brush: BrushBehavior<unknown>;
	brushHandler: (dim: string, dir?: BRUSHING_DIRECTION) => void;

	// Visualization control member variables
	NANIndicatorEnabled: boolean;

	// UI member variables
	node: Selection<SVGGElement, unknown, null, undefined>; // root node as given by parent element
	axisGroup: Selection<SVGGElement, unknown, null, undefined>; // g element containing axis
	brushGroup: Selection<SVGGElement, unknown, null, undefined>; // g element containing brush

	// Throttling
	timerId: NodeJS.Timeout | undefined;

	constructor(
		dimension: DimType,
		protected brushRectWidth: number = 14
	) {
		this.dimension = dimension;

		switch (dimension.attr_type) {
			case ATTRIBUTE_TYPE.NUMERICAL:
				this.scale = new NumericalAxisScaleImpl(dimension.statistics as { min: number; max: number });
				break;
			case ATTRIBUTE_TYPE.NOMINAL:
				this.scale = new NominalAxisScaleImpl(dimension.statistics as Array<string>);
				break;
			default:
				throw new Error("PAVEDJS: Cannot create axis: unknown attribute type!");
		}

		this.brush = brushY();

		this.NANIndicatorEnabled = false;

		this.brushHandler = () => {};

		this.registerAxis = this.registerAxis.bind(this);
	}

	public registerAxis(group: Selection<SVGGElement, unknown, null, undefined>) {
		this.node = group;

		this.initCanvas();
		this.render();
	}

	protected throttleFunction(
		func: (dim: string, dir?: BRUSHING_DIRECTION) => void,
		delay: number,
		direction?: BRUSHING_DIRECTION
	) {
		// If setTimeout is already scheduled, no need to do anything
		if (this.timerId) {
			return;
		}

		// Schedule a setTimeout after delay seconds
		this.timerId = setTimeout(() => {
			func(this.dimension.name, direction);

			// Once setTimeout function execution is finished, timerId = undefined so that function execution can be scheduled by the setTimeout
			this.timerId = undefined;
		}, delay);
	}

	public getDimension(): DimType {
		return this.dimension;
	}

	public setDimension(dim: DimType): DefaultAxis<DimType> {
		this.dimension = dim;
		return this;
	}

	public setDimensionName(name: string): DefaultAxis<DimType> {
		this.dimension.name = name;

		return this;
	}

	public getScale(): IAxisScale {
		return this.scale;
	}

	public setScale(range: [number, number], domain: [number, number] | Array<string>): DefaultAxis<DimType> {
		this.scale.setScale(range, domain);

		// Adjust brush extent to new scale
		this.brush.extent([
			[-this.brushRectWidth / 2, range[1]],
			[this.brushRectWidth / 2, range[0]],
		]);

		return this;
	}

	public getBrushHandler(): (dim: string, dir?: BRUSHING_DIRECTION) => void {
		return this.brushHandler;
	}

	public setBrushHandler(brushHandler: (dim: string, dir?: BRUSHING_DIRECTION) => void): DefaultAxis<DimType> {
		this.brushHandler = brushHandler;
		this.brush
			.on("brush", () => {
				let direction;
				const brushGroupNode = this.brushGroup.node();
				// Brush is non-empty
				if (brushGroupNode !== null) {
					const brushRange = brushSelection(brushGroupNode);
					if (brushRange !== null) {
						// Determine whether brush was shrinked or extended. If it was moved, do not specify a direction
						const upperBound = this.brushGroup.select<SVGTextElement>(".upper");
						const currUpper = Number(upperBound.attr("y"));
						const lowerBound = this.brushGroup.select<SVGTextElement>(".lower");
						const currLower = Number(lowerBound.attr("y"));
						const nextUpper = brushRange[0] as number;
						const nextLower = brushRange[1] as number;
						// Brush range changed (not only moved entirely)
						if (currUpper - currLower !== nextUpper - nextLower) {
							// Brush has just been created
							if (currUpper === null || currLower === null) direction = BRUSHING_DIRECTION.SHRINK;
							// One border of the brush has been moved
							else {
								direction = BRUSHING_DIRECTION.EXTEND;

								if (nextUpper > currUpper || nextLower < currLower)
									direction = BRUSHING_DIRECTION.SHRINK;
							}
						}

						// Position of these labels is used as a proxy for "old" brush range
						upperBound.attr("y", brushRange[0]);
						lowerBound.attr("y", brushRange[1]);

						// For numerical axes, update text and visibility of labels for upper and lower bound
						if (this.scale instanceof NumericalAxisScaleImpl) {
							upperBound
								.text(this.scale.rangeToDomainLabel(brushRange[0] as number))
								.style("display", "block");

							lowerBound
								.text(this.scale.rangeToDomainLabel(brushRange[1] as number))
								.style("display", "block");
						}
					}
				}

				// Throttles brushHandler method such that it is called once in every 200 milliseconds
				this.throttleFunction(brushHandler, 300, direction);
			})
			// Needed for design parameter axes, where a removal of brush via click outside only triggers "end"
			// Brush was removed -> hide brush labels and update rendering
			.on("end", () => {
				const brushGroupNode = this.brushGroup.node();
				if (brushGroupNode !== null && brushSelection(brushGroupNode) === null) {
					this.brushGroup.select(".upper").style("display", "none");
					this.brushGroup.select(".lower").style("display", "none");

					brushHandler(this.dimension.name, BRUSHING_DIRECTION.EXTEND);
				}
			});

		return this;
	}

	/** Reset brush such that no restriction remains
	 * */
	public clearBrush(): DefaultAxis<DimType> {
		if (this.brush && this.brushGroup) this.brush.move(this.brushGroup, null);

		return this;
	}

	public isBrushed(domainValue: number | string): boolean {
		const brushGroupNode = this.brushGroup.node();
		// If there is a selection on this axis, compute brushed values
		if (brushGroupNode !== null) {
			const brushRange = brushSelection(brushGroupNode);
			if (brushRange !== null) {
				// "NaN" values should not be brushed
				const valueInvalid = domainValue === "NaN";
				if (valueInvalid) return false;
				const brushedRange = [brushRange[1] as number, brushRange[0] as number];
				const rangeVal = this.getScale().domainToRange(domainValue);
				if (rangeVal !== undefined)
					// Round to 6 decimals to not miss number equality due to slight changes in the 20th+ digit
					return (
						Number(brushedRange[0].toFixed(6)) >= Number(rangeVal.toFixed(6)) &&
						Number(rangeVal.toFixed(6)) >= Number(brushedRange[1].toFixed(6))
					);
				else return false;
			}
			// If there is no selection, return true
			else return true;
		}
		// If there is no selection, return true
		else return true;
	}

	public setNANIndicatorEnabled(enabled: boolean): DefaultAxis<DimType> {
		this.NANIndicatorEnabled = enabled;

		return this;
	}

	protected initCanvas(): void {
		// AXIS
		this.axisGroup = this.node.append("g").attr("class", "axis");
		this.axisGroup.append("text").attr("class", "label");

		// Brush
		this.brushGroup = this.node.append("g").attr("class", "brush");
		// Add labels for upper and lower bound
		this.brushGroup.append("text").attr("class", "upper").attr("x", -9).style("display", "none");
		this.brushGroup.append("text").attr("class", "lower").attr("x", -9).style("display", "none");

		// NAN indicator
		this.node
			.append("circle")
			.attr("cy", this.scale.getRange()[0] + 15)
			.attr("r", 4)
			.attr("display", "none");
	}

	public render(): void {
		// Update axis scale
		this.axisGroup.call(axisLeft(this.getScale().scale).tickValues(this.scale.getDomain()));
		// Update title
		const text = [this.dimension.name, this.dimension.unit];
		const label = this.axisGroup
			.select("text.label")
			.attr("transform", "translate (0," + (this.scale.getRange()[0] + 13) + ") rotate(-20)");
		const update = label.selectAll<SVGTSpanElement, string>("tspan").data(text);

		// Update existing text lines
		update.text((line: string | undefined, idx: number) => {
			return line ? (idx === 1 ? "(" + line + ")" : line) : null;
		});

		// New text lines
		update
			.enter()
			.append("tspan")
			.text((line: string | undefined, idx: number) => {
				return line ? (idx === 1 ? "(" + line + ")" : line) : null;
			})
			.attr("x", 0)
			.attr("dy", 17);

		// Remove surplus of text lines
		update.exit().remove();

		// Update brush
		this.brushGroup.call(this.brush);

		// Update NAN indicator
		this.node.select("circle").style("display", () => {
			return this.NANIndicatorEnabled ? "block" : "none";
		});
	}
}
