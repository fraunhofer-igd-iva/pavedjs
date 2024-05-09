import { pointer, select, Selection } from "d3-selection";
import { Line, line } from "d3-shape";

import * as Raphael from "raphael";

/*** GEOMETRY HELPER ***/

interface Point {
	x: number;
	y: number;
}

export interface IBrush {
	(group: Selection<SVGGElement, unknown, null, undefined>): IBrush;

	// Use overloading for D3 getter/setter pattern
	setStart(start?: Point): Point | IBrush; // Getter if no argument is provided, setter otherwise
	setEnd(end?: Point): Point | IBrush; // Getter if no argument is provided, setter otherwise
	getPath(): SVGPathElement | null;
	evolve(position: Point): void;
	process(position: Point): void;
	cancel(): void;
	brushed(path: SVGPathElement): boolean;

	initCanvas(): void;
	render(): void;
}

export const lineBrush = (width: number, height: number, brushCallback: () => void): IBrush => {
	let started: boolean = false;
	let ended: boolean = false;
	let visible: boolean = false;
	let start: Point = { x: 0, y: 0 };
	let end: Point = { x: 0, y: 0 };
	let lineGenerator: Line<Point>;

	let brushGroup: Selection<SVGGElement, unknown, null, undefined>;
	let linePath: Selection<SVGPathElement, unknown, null, undefined>;
	let headCircle: Selection<SVGCircleElement, unknown, null, undefined>;
	let tailCircle: Selection<SVGCircleElement, unknown, null, undefined>;

	/**
	 * The command to actually render the brush after set up.
	 * @public
	 * @param {string} svg - The SVG that you want to render in
	 */
	const brush = ((group: Selection<SVGGElement, unknown, null, undefined>) => {
		brushGroup = group;

		// Function generating a straight line from two points
		lineGenerator = line<Point>()
			.x((d: Point) => d.x)
			.y((d: Point) => d.y);

		brush.initCanvas();
	}) as IBrush;

	/**
	 * Set/get the start point of the brush.
	 * @returns start, if no arguments were provided.
	 */
	brush.setStart = function (startPoint?: Point): Point | IBrush {
		if (startPoint === undefined) {
			return start;
		} else {
			start = startPoint;
			return brush;
		}
	};

	/**
	 * Set/get the end point of the brush.
	 * @returns end, if no arguments were provided.
	 */
	brush.setEnd = function (endPoint?: Point): Point | IBrush {
		if (endPoint === undefined) {
			return end;
		} else {
			end = endPoint;
			return brush;
		}
	};

	brush.getPath = function (): SVGPathElement | null {
		if (visible) return brushGroup.select<SVGPathElement>("path.linebrush").node();
		else return null;
	};

	/**
	 * Draw the line brush from start point to moving cursor, such that the user can see which time series the line brush
	 * is going to cross if he releases the mouse button.
	 */
	brush.evolve = function (position: Point): void {
		if (started && !ended) brush.setEnd(position);

		brush.render();
	};

	/**
	 * Set start point on first mouse press.
	 * Set end point if start point was already set and trigger the computation of the resulting brush.
	 */
	brush.process = function (position: Point): void {
		if (!started) {
			started = true;
			ended = false;
			visible = true;
			brush.setStart(position);
			brush.setEnd(position);
		} else if (!ended) {
			ended = true;
			brush.setEnd(position);

			// Add move listeners to head and tail circles
			const head = brushGroup.select("#head").style("pointer-events", "fill");
			let dragHeadActive = false;
			head.on("mousedown", () => {
				dragHeadActive = true;
			}).on("mouseup", () => {
				dragHeadActive = false;
				brushCallback();
			});
			brushGroup.select("rect").on("mousemove.dragHead", (event: MouseEvent) => {
				if (dragHeadActive) {
					const x = pointer(event, brushGroup.node())[0],
						y = pointer(event, brushGroup.node())[1];

					brush.setStart({ x: x, y: y });
					brush.render();
				}
			});

			const tail = brushGroup.select("#tail").style("pointer-events", "fill");
			let dragTailActive = false;
			tail.on("mousedown", () => {
				dragTailActive = true;
			}).on("mouseup", () => {
				dragTailActive = false;
				brushCallback();
			});
			brushGroup.select("rect").on("mousemove.dragTail", (event: MouseEvent) => {
				if (dragTailActive) {
					const x = pointer(event, brushGroup.node())[0],
						y = pointer(event, brushGroup.node())[1];

					brush.setEnd({ x: x, y: y });
					brush.render();
				}

				event.preventDefault();
				event.stopPropagation();
			});

			// Trigger computation by parent plot
			brushCallback();
		}

		brush.render();
	};

	/**
	 * Cancel the on-going brush.
	 * Nothing is processed and the line brush is reset and hidden.
	 */
	brush.cancel = function (): void {
		started = false;
		ended = false;
		visible = false;

		// Remove move listeners from head and tail circles
		const head = brushGroup.select("#head").style("pointer-events", "none");
		head.on("mousedown", null).on("mouseup", null);
		brushGroup.select("rect").on("mousemove.dragHead", null);
		const tail = brushGroup.select("#tail").style("pointer-events", "none");
		tail.on("mousedown", null).on("mouseup", null);
		brushGroup.select("rect").on("mousemove.dragTail", null);

		// Trigger computation by parent plot
		brushCallback();

		brush.render();
	};

	/**
	 * Determine whether a given path is brushed by the line brush.
	 * If no line brush was specified, returns true.
	 */
	brush.brushed = function (path: SVGPathElement): boolean {
		const brushPath = this.getPath();

		if (brushPath !== null) {
			const pathDescr = path.getAttribute("d");
			const lineDescr = brushPath.getAttribute("d");

			if (pathDescr && lineDescr) {
				const points = Raphael.pathIntersection(pathDescr, lineDescr);
				return points.length > 0;
			} else return true;
		} else {
			// If there is no selection, return true
			return true;
		}
	};

	brush.initCanvas = function (): void {
		// Hidden rect to trigger mouse events and bubble them up to group
		brushGroup
			.append("rect")
			.attr("width", width)
			.attr("height", height)
			.style("visibility", "hidden")
			.on("click", (event: MouseEvent) => {
				const x = pointer(event, brushGroup.node())[0],
					y = pointer(event, brushGroup.node())[1];

				brush.process({ x: x, y: y });

				event.preventDefault();
				event.stopPropagation();
			})
			.on("mousemove", (event: MouseEvent) => {
				const x = pointer(event, brushGroup.node())[0],
					y = pointer(event, brushGroup.node())[1];

				brush.evolve({ x: x, y: y });

				event.preventDefault();
				event.stopPropagation();
			});
		// Handle escape key
		select("body").on("keydown", (event: KeyboardEvent) => {
			if (event.key === "Escape")
				// ESC pressed
				brush.cancel();
		});

		// Path representing actual line brush
		linePath = brushGroup
			.append("path")
			.attr("class", "linebrush") // to distinguish it from foreground lines
			.attr("d", lineGenerator([start, end]))
			.style("display", "none")
			.style("stroke", "black")
			.style("pointer-events", "none");

		// Circles marking tail and head
		headCircle = brushGroup
			.append("circle")
			.attr("id", "head")
			.attr("r", "3")
			.attr("cx", start.x)
			.attr("cy", start.y)
			.attr("fill", "black")
			.style("display", "none")
			.style("pointer-events", "none")
			.style("cursor", "move");
		tailCircle = brushGroup
			.append("circle")
			.attr("id", "tail")
			.attr("r", "3")
			.attr("cx", end.x)
			.attr("cy", end.y)
			.attr("fill", "black")
			.style("display", "none")
			.style("pointer-events", "none")
			.style("cursor", "move");
	};

	brush.render = function (): void {
		const display = visible ? "inline" : "none";

		// Update line brush
		linePath.attr("d", lineGenerator([start, end])).style("display", () => {
			return display;
		});

		// Update head and tail
		headCircle
			.attr("cx", start.x)
			.attr("cy", start.y)
			.style("display", () => {
				return display;
			});
		tailCircle
			.attr("cx", end.x)
			.attr("cy", end.y)
			.style("display", () => {
				return display;
			});
	};

	return brush;
};
