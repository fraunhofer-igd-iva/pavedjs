import { brushSelection } from "d3-brush";

import { ATTRIBUTE_TYPE, BRUSHING_DIRECTION, Objective, OPTIMIZATION_TYPE } from "../types";
import { DefaultAxis } from "../ParallelCoordinates/DefaultAxis";
import { ParameterAxis } from "./ParameterAxis";
import { NumericalAxisScaleImpl } from "../scale";

/** Axis for attributes in parallel coordinates for optimization
 *  Includes customized brushing with optional gradient, and visual optimization-related hints
 */

enum HANDLE_TYPE {
	North = "handle--n",
	South = "handle--s",
}

// Objective axes cannot be created from categorical attributes, because they do not have an inherent order

export class ObjectiveAxis extends ParameterAxis<Objective> {
	protected triggeredByCustomHandle: boolean;

	constructor(
		dimension: Objective,
		public color: string | null = null,
		public handleWidth: number = 20
	) {
		// Super call must be the first statement in the constructor, so this is a workaround to check the attribute
		// type prior to axis creation
		super(
			(() => {
				if (dimension.attr_type !== ATTRIBUTE_TYPE.NUMERICAL)
					throw new Error("PAVEDJS: Cannot create ObjectiveAxis for non-numerical dimensions!");
				return dimension;
			})()
		);

		this.triggeredByCustomHandle = false;
	}

	protected getTranslation(transform: string) {
		// Create a dummy g for calculation purposes only. This will never
		// be appended to the DOM and will be discarded once this function
		// returns.
		const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

		// Set the transform attribute to the provided string value.
		g.setAttributeNS(null, "transform", transform);

		// consolidate the SVGTransformList containing all transformations
		// to a single SVGTransform of type SVG_TRANSFORM_MATRIX and get
		// its SVGMatrix.
		const svgTransform = g.transform.baseVal.consolidate();
		const matrix =
			svgTransform !== null
				? svgTransform.matrix
				: document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGMatrix();

		// As per definition values e and f are the ones for the translation.
		return [matrix.e, matrix.f];
	}

	public setBrushHandler(brushHandler: (dim: string, dir?: BRUSHING_DIRECTION) => void): ObjectiveAxis {
		this.brushHandler = brushHandler;
		this.brush.on("brush", () => {
			let direction = BRUSHING_DIRECTION.EXTEND;
			// Move custom brush handle to new position
			this.brushGroup
				.filter(function (this: SVGGElement) {
					return brushSelection(this) !== null;
				})
				.each(() => {
					const brushGroupNode = this.brushGroup.node();
					if (brushGroupNode !== null) {
						const brushRange = brushSelection(brushGroupNode);
						if (brushRange !== null) {
							const nextBound =
								this.dimension.obj === OPTIMIZATION_TYPE.MAX ? brushRange[1] : brushRange[0];
							const currBound = this.brushGroup.select(".handle--custom").attr("transform")
								? this.getTranslation(this.brushGroup.select(".handle--custom").attr("transform"))[1]
								: nextBound;
							if (
								(this.dimension.obj === OPTIMIZATION_TYPE.MIN && nextBound > currBound) ||
								(this.dimension.obj === OPTIMIZATION_TYPE.MAX && nextBound < currBound)
							)
								direction = BRUSHING_DIRECTION.SHRINK;
							this.brushGroup
								.select(".handle--custom")
								.attr("transform", () => {
									return " translate(" + [0, nextBound] + ")";
								})
								.select("text")
								.text(() => {
									const rangeValue: number = nextBound as number;
									// Objective axes are implicitly numerical
									if (this.scale instanceof NumericalAxisScaleImpl)
										return this.scale.rangeToDomainLabel(rangeValue);
									else return "NaN";
								});
						}
					}
				});

			// Throttles brushHandler method such that it is called once in every 300 milliseconds
			this.throttleFunction(brushHandler, 300, direction);

			this.triggeredByCustomHandle = false;
		});

		return this;
	}

	public setColor(color: string) {
		this.color = color;
	}

	public unsetColor() {
		this.color = null;
	}

	public getColor(): string | null {
		return this.color;
	}

	// Override from DefaultAxis
	public clearBrush(): DefaultAxis<Objective> {
		const range = this.scale.getRange();
		const fullRange: [number, number] = [range[1], range[0]];
		this.brush.move(this.brushGroup, fullRange);

		return this;
	}

	private updateTriangleIndicator(): void {
		let points;
		const canvasHeight = this.scale.getRange()[0];
		if (this.dimension.obj === OPTIMIZATION_TYPE.MIN)
			points = "0," + canvasHeight + " 7," + (canvasHeight + 10) + " -7," + (canvasHeight + 10);
		else if (this.dimension.obj === OPTIMIZATION_TYPE.MAX) points = "0,0 7,-10 -7,-10";
		else points = "";
		this.axisGroup
			.select(".triangle")
			.attr("points", points)
			.attr("style", "fill: " + this.color);
	}

	private addCustomExtentHandle(): void {
		const type: { type: "s" | "n" } = this.dimension.obj === OPTIMIZATION_TYPE.MIN ? { type: "n" } : { type: "s" };
		this.brushGroup
			.selectAll<SVGGElement, { type: "s" | "n" }>(".handle--custom")
			.data([type])
			.enter()
			.append("g")
			.attr("class", "handle--custom")
			.attr("pointer-events", "none")
			.append("path")
			.attr("d", () => {
				const r = this.handleWidth / 2 + 2;
				return (
					"M " +
					-r / 2 +
					"," +
					-this.handleWidth / 2 +
					" A " +
					r +
					"," +
					r +
					" 0 1 1 " +
					-r / 2 +
					"," +
					this.handleWidth / 2 +
					" Z"
				);
			})
			.attr("transform", (d) => {
				return d.type === "n" ? "rotate(-90) translate(6,0)" : "rotate(90) translate(6,0)";
			});

		const customHandle = this.brushGroup.select(".handle--custom");
		customHandle.append("text").attr("transform", () => {
			const offsetY = this.dimension.obj ? 11 : -5;
			return "translate(0," + offsetY + ")";
		});
	}

	public customizeBrush(): void {
		// Remove brush move handle
		this.brushGroup.select("rect.selection").style("cursor", "default"); // Mouse events are filtered out
		// Remove brush cross handle
		this.brushGroup.selectAll("rect.overlay").style("cursor", "default"); // Mouse events are filtered out
		// Remove handle at desired end of axis to suppress filtering from that side
		const handle = this.dimension.obj === OPTIMIZATION_TYPE.MIN ? HANDLE_TYPE.South : HANDLE_TYPE.North;
		this.brushGroup.selectAll("rect.handle." + handle).remove();
	}

	protected initCanvas(): void {
		super.initCanvas();

		this.axisGroup.append("polygon").attr("class", "triangle");

		this.brushGroup.call(this.brush);

		// Add custom extent handle
		this.addCustomExtentHandle();

		this.brushGroup
			.selectAll("rect")
			.attr("x", -this.brushRectWidth / 2)
			.attr("width", this.brushRectWidth);

		// Position handles correctly
		this.clearBrush();
	}

	public render(): void {
		super.render();

		// This is necessary, because this.brushGroup.call(this.brush) in render method again adds the original handles already removed in initCanvas()
		this.customizeBrush();

		// Update axis and ticks colors
		this.axisGroup.select("path.domain").attr("style", "stroke: " + this.color);
		this.axisGroup.selectAll("line").attr("style", "stroke: " + this.color);
		// Update triangle indicator
		this.updateTriangleIndicator();
	}
}
