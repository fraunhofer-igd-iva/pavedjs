import {
	ATTRIBUTE_TYPE,
	DataColumns,
	DataRow,
	DataRows,
	DataTable,
	Dimension,
	DimensionPreview,
	Objective,
} from "./types";

/**
 * Custom type guard that determines whether a given attribute is of type {@link Objective}.
 * @param {(Dimension | Objective)} dim - The attribute to be checked.
 * @returns - Type predicate: true if the attribute is an {@link Objective}, false otherwise.
 */
export function hasTypeObjective(dim: Dimension | Objective): dim is Objective {
	return "obj" in dim;
}

/**
 * Custom type guard that determines whether a given data set is of type {@link DataRows}.
 * @param {(DataRows | DataTable)} data - The data set to be checked.
 * @returns - Type predicate: true if the data set is of type {@link DataRows}, false otherwise.
 */
export function hasTypeDataRows(data: DataRows | DataTable): data is DataRows {
	return Array.isArray(data);
}

/**
 * Custom type guard that determines whether a given data set is of type {@link DataTable}.
 * @param {(DataRows | DataTable)} data - The data set to be checked.
 * @returns - Type predicate: true if the data set is of type {@link DataTable}, false otherwise.
 */
export function hasTypeDataTable(data: DataRows | DataTable): data is DataTable {
	return !hasTypeDataRows(data);
}

/**
 * Extract column names from first data item.
 * @param {DataRows} rows - The data items to be processed.
 * @returns {Array<DimensionPreview>} - The list of column objects initialized with column names.
 */
export function initColumnsFromRows(rows: DataRows): Array<DimensionPreview> {
	if (rows.length === 0) return [];
	else
		return Object.keys(rows[0]).map((k) => {
			return { name: k };
		});
}

/**
 * If data items do not contain unique IDs, insert auto-incremented IDs.
 * @param {DataRows} rows - The data items to be processed.
 * @returns {[boolean, DataRows]} - A boolean specifying whether IDs have been inserted and the (updated) data items.
 */
export function insertIDs(rows: DataRows): [boolean, DataRows] {
	let generated = false;
	const res = [...rows]; // Do not modify rows outside of function
	res.forEach((row: DataRow, i: number) => {
		if (!("ID" in row || "id" in row || "Id" in row)) {
			(row as DataRow).ID = i;
			generated = true;
		}
	});

	return [generated, res];
}

/**
 * For each attribute, compute attribute type and statistics (min/max or unique categories) from the data set.
 * Can handle NaN values.
 * @param {Array<DimensionPreview>} columns - The column objects previously initialized from the data set.
 * @param {DataRows} rows - The data items to be processed.
 * @returns {DataColumns} - The list of columns including meta data.
 * @throws Error, if attribute values are invalid (not a number or string) or have mixed types (e.g., some are numbers, some are strings).
 */
export function deriveColumnMetaData(columns: Array<DimensionPreview>, rows: DataRows): DataColumns {
	const columnsWithMetaData: DataColumns = [];
	columns.forEach((attr: DimensionPreview) => {
		const metadata: {
			attr_type: ATTRIBUTE_TYPE | null;
			statistics: { min: number; max: number } | Array<string> | null;
		} = { attr_type: null, statistics: null };

		// Derive attribute type and domain from attribute values
		const attr_values = rows.map((row: DataRow) => {
			return row[attr.name];
		});
		// All values are numerical
		if (attr_values.every((val: unknown) => typeof val === "number" || val === "NaN")) {
			metadata.attr_type = ATTRIBUTE_TYPE.NUMERICAL;
			// Convert value types to number
			const num_attr_values: Array<number> = attr_values.map((val: unknown) => Number(val)); // "NaN" converts to Number.NaN of type number
			// Compute min and max
			metadata.statistics = {
				min: Math.min.apply(
					Math,
					num_attr_values.filter((val) => !isNaN(val))
				),
				max: Math.max.apply(
					Math,
					num_attr_values.filter((val) => !isNaN(val))
				),
			};
		}
		// All values are categorical
		else if (attr_values.every((val: unknown) => typeof val === "string")) {
			metadata.attr_type = ATTRIBUTE_TYPE.NOMINAL;
			// Convert value types to string
			const str_attr_values: Array<string> = attr_values.map((val: unknown) => val as string);
			// Compute unique categorical values
			metadata.statistics = str_attr_values.filter((value, index, self) => self.indexOf(value) === index);
		}
		// Values have invalid or mixed types
		else {
			throw new Error("PAVEDJS: Could not determine attribute type and domain of " + attr.name + ".");
		}

		columnsWithMetaData.push({ ...attr, ...metadata } as Dimension);
	});

	return columnsWithMetaData;
}

/**
 * Convert a given list of data items to the internal data structure.
 * @param {DataRows} rows - The data items to be processed.
 * @returns {[DataColumns, DataRows]} - Columns and rows with all meta data available from the input data set.
 */
export function prepareData(rows: DataRows): [DataColumns, DataRows] {
	const columns: Array<DimensionPreview> = initColumnsFromRows(rows);
	const [idsGenerated, modifiedRows] = insertIDs(rows);
	if (idsGenerated) {
		columns.unshift({ name: "ID" });
	}
	return [deriveColumnMetaData(columns, modifiedRows), modifiedRows];
}
