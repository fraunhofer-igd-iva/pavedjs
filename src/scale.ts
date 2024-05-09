import { ScaleLinear, scaleLinear, ScalePoint, scalePoint } from "d3-scale";

/**
 * The interface representing a scale underlying a chart axis.
 * @property {(ScalePoint | ScaleLinear)} scale - The internal D3 scale, linear scale for numerical attributes, point scale for nominal attributes.
 * @method {function} [rangeToDomainLabel] - Given a value from the range, returns the corresponding value from the domain according to the tick format.
 * @method {function} domainToRange - Given a value from the domain, returns the corresponding value from the range.
 * @method {function} setScale - Updates the scale's range and domain.
 * @method {function} getRange - Returns the scale's current range.
 * @method {function} getDomain - Returns the scale's current domain.
 * @method {function} getTickFormat - Returns the scale's current tick format function.
 * @interface
 */
export interface IAxisScale {
	// any is needed to remove error in DefaultAxis.ts l.245
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	scale: any | ScalePoint<string> | ScaleLinear<number, number>;

	rangeToDomainLabel?(rangeVal: number): string;
	domainToRange(val: number | string): number | undefined;
	setScale(range: [number, number], domain: [number, number] | Array<string>): void;
	getRange(): [number, number];
	getDomain(): [number, number] | Array<string>;
	getTickFormat(): (domainValue: number | string) => string;
}

export class NominalAxisScaleImpl implements IAxisScale {
	scale: ScalePoint<string>;

	constructor(domain: Array<string>) {
		this.scale = scalePoint().domain(domain).padding(0.5);
	}

	getRange(): [number, number] {
		return this.scale.range() as [number, number];
	}

	getDomain(): Array<string> {
		return this.scale.domain();
	}

	getTickFormat(): (domainValue: number | string) => string {
		return (domainValue: number | string) => {
			if (typeof domainValue === "string") return domainValue;
			else return domainValue.toFixed(2);
		};
	}

	setScale(range: [number, number], domain: Array<string>): void {
		this.scale.range(range).domain(domain);
	}

	domainToRange(val: string): number | undefined {
		return this.scale(val);
	}
}

export class NumericalAxisScaleImpl implements IAxisScale {
	scale: ScaleLinear<number, number>;

	constructor(domain: { min: number; max: number }) {
		this.scale = scaleLinear().domain([domain.min, domain.max]);
	}

	getRange(): [number, number] {
		return this.scale.range() as [number, number];
	}

	getDomain(): [number, number] {
		return this.scale.domain() as [number, number];
	}

	getTickFormat(): (domainValue: number | string) => string {
		return (domainValue: number | string) => {
			if (typeof domainValue === "string") return domainValue;
			else return this.scale.tickFormat()(domainValue);
		};
	}

	setScale(range: [number, number], domain: [number, number]): void {
		this.scale.range(range).domain(domain);
	}

	rangeToDomainLabel(rangeVal: number): string {
		const value: number = this.scale.invert(rangeVal);
		return this.scale.tickFormat()(value);
	}

	domainToRange(val: number): number | undefined {
		return this.scale(val);
	}
}
