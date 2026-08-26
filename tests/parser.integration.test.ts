import { describe, it, expect } from "vitest";
import { parseDocument } from "../electron/parser";
import * as fs from "fs";
import * as path from "path";

describe("parseDocument real files", () => {
  const sampleDir = path.join(process.cwd(), "tests", "sample-docs-parse");

  it("parses all sample files in tests/sample-docs-parse", async () => {
    const files = fs.readdirSync(sampleDir);

    for (const file of files) {
      const filePath = path.join(sampleDir, file);
      const result = await parseDocument(filePath);

      console.log(`Parsed result for ${file}:`, result);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("description");
      expect(result).toHaveProperty("date");
      expect(result).toHaveProperty("rawText");
    }
  });
});
