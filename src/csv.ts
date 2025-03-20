import { writeFileSync } from "fs";
import { Parser } from "json2csv";

/**
 * Saves a JSON object to a CSV file.
 * @param jsonData - The JSON data to convert to CSV.
 * @param filePath - The path where the CSV file should be saved.
 */
function saveJsonToCsv(jsonData: any[], filePath: string) {
  try {
    if (!Array.isArray(jsonData)) {
      throw new Error("Expected an array of objects but received a non-array value.");
    }

    const parser = new Parser();
    const csv = parser.parse(jsonData);

    writeFileSync(filePath, csv);
    console.log(`Data successfully saved to ${filePath}`);
  } catch (error) {
    console.error("Error saving data to CSV:", error);
  }
}

export { saveJsonToCsv };