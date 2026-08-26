import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../electron/parser/pdf-parser", () => ({
  parsePdf: vi.fn(),
}));

vi.mock("../electron/parser/office-parser", () => ({
  parseOffice: vi.fn(),
}));

vi.mock("../electron/parser/spreadsheet-parser", () => ({
  parseSpreadsheet: vi.fn(),
}));

vi.mock("../electron/parser/presentation-parser", () => ({
  parsePresentation: vi.fn(),
}));

vi.mock("../electron/parser/image-ocr", () => ({
  ocrImage: vi.fn(),
}));

import { parseDocument } from "../electron/parser";
import { parsePdf } from "../electron/parser/pdf-parser";
import { parseOffice } from "../electron/parser/office-parser";
import { parseSpreadsheet } from "../electron/parser/spreadsheet-parser";
import { parsePresentation } from "../electron/parser/presentation-parser";
import { ocrImage } from "../electron/parser/image-ocr";
import { normalizeExt, extractInfoFromText } from "../electron/parser/utils";

describe("parseDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes pdf files to parsePdf", async () => {
    vi.mocked(parsePdf).mockResolvedValue("pdf text");
    const result = await parseDocument("/tmp/test.pdf");
    expect(parsePdf).toHaveBeenCalledWith("/tmp/test.pdf");
    expect(result.rawText).toBe("pdf text");
  });

  it("routes doc files to parseOffice", async () => {
    vi.mocked(parseOffice).mockResolvedValue("doc text");
    const result = await parseDocument("/tmp/test.doc");
    expect(parseOffice).toHaveBeenCalledWith("doc", "/tmp/test.doc");
    expect(result.rawText).toBe("doc text");
  });

  it("routes docx files to parseOffice", async () => {
    vi.mocked(parseOffice).mockResolvedValue("docx text");
    const result = await parseDocument("/tmp/test.docx");
    expect(parseOffice).toHaveBeenCalledWith("docx", "/tmp/test.docx");
    expect(result.rawText).toBe("docx text");
  });

  it("routes xls files to parseSpreadsheet", async () => {
    vi.mocked(parseSpreadsheet).mockResolvedValue("xls text");
    const result = await parseDocument("/tmp/test.xls");
    expect(parseSpreadsheet).toHaveBeenCalledWith("/tmp/test.xls");
    expect(result.rawText).toBe("xls text");
  });

  it("routes xlsx files to parseSpreadsheet", async () => {
    vi.mocked(parseSpreadsheet).mockResolvedValue("xlsx text");
    const result = await parseDocument("/tmp/test.xlsx");
    expect(parseSpreadsheet).toHaveBeenCalledWith("/tmp/test.xlsx");
    expect(result.rawText).toBe("xlsx text");
  });

  it("routes ppt files to parsePresentation", async () => {
    vi.mocked(parsePresentation).mockResolvedValue("ppt text");
    const result = await parseDocument("/tmp/test.ppt");
    expect(parsePresentation).toHaveBeenCalledWith("/tmp/test.ppt");
    expect(result.rawText).toBe("ppt text");
  });

  it("routes pptx files to parsePresentation", async () => {
    vi.mocked(parsePresentation).mockResolvedValue("pptx text");
    const result = await parseDocument("/tmp/test.pptx");
    expect(parsePresentation).toHaveBeenCalledWith("/tmp/test.pptx");
    expect(result.rawText).toBe("pptx text");
  });

  it("routes png files to ocrImage", async () => {
    vi.mocked(ocrImage).mockResolvedValue("ocr text");
    const result = await parseDocument("/tmp/test.png");
    expect(ocrImage).toHaveBeenCalledWith("/tmp/test.png");
    expect(result.rawText).toBe("ocr text");
  });

  it("routes jpg files to ocrImage", async () => {
    vi.mocked(ocrImage).mockResolvedValue("ocr text");
    const result = await parseDocument("/tmp/test.jpg");
    expect(ocrImage).toHaveBeenCalledWith("/tmp/test.jpg");
    expect(result.rawText).toBe("ocr text");
  });

  it("uses fileType override instead of extension", async () => {
    vi.mocked(parsePdf).mockResolvedValue("override text");
    const result = await parseDocument("/tmp/test.xyz", "pdf");
    expect(parsePdf).toHaveBeenCalledWith("/tmp/test.xyz");
    expect(result.rawText).toBe("override text");
  });

  it("returns empty text for unsupported extensions", async () => {
    const result = await parseDocument("/tmp/test.xyz");
    expect(result.rawText).toBe("");
  });

  it("handles parser errors gracefully", async () => {
    vi.mocked(parsePdf).mockRejectedValue(new Error("parse failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await parseDocument("/tmp/test.pdf");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error parsing /tmp/test.pdf:",
      expect.any(Error),
    );
    expect(result.rawText).toBe("");
    consoleSpy.mockRestore();
  });

  it("truncates rawText to 8000 characters", async () => {
    const longText = "a".repeat(9000);
    vi.mocked(parsePdf).mockResolvedValue(longText);
    const result = await parseDocument("/tmp/test.pdf");
    expect(result.rawText).toHaveLength(8000);
  });

  it("returns parsed info from text", async () => {
    vi.mocked(parsePdf).mockResolvedValue("Activity Name\nDescription here");
    const result = await parseDocument("/tmp/test.pdf");
    expect(result.name).toBe("Activity Name");
    expect(result.description).toBe("Description here");
    expect(result.date).toBe(new Date().toISOString().split("T")[0]);
  });
});

describe("normalizeExt", () => {
  it("extracts extension from file path", () => {
    expect(normalizeExt("/tmp/test.pdf")).toBe("pdf");
  });

  it("lowercases extension", () => {
    expect(normalizeExt("/tmp/test.PDF")).toBe("pdf");
  });

  it("removes leading dot", () => {
    expect(normalizeExt("/tmp/test.PDF")).toBe("pdf");
  });

  it("uses fileType override when provided", () => {
    expect(normalizeExt("/tmp/test.xyz", "pdf")).toBe("pdf");
  });

  it("falls back to extension when fileType is empty", () => {
    expect(normalizeExt("/tmp/test.pdf", "")).toBe("pdf");
  });
});

describe("extractInfoFromText", () => {
  it("returns Unknown Activity and No description found for empty text", () => {
    const result = extractInfoFromText("");
    expect(result.name).toBe("Unknown Activity");
    expect(result.description).toBe("No description found.");
  });

  it("extracts name from first non-empty line", () => {
    const result = extractInfoFromText(
      "Sosialisasi Peraturan\nDetail kegiatan\nTanggal: 01-01-2024",
    );
    expect(result.name).toBe("Sosialisasi Peraturan");
  });

  it("extracts description from lines 2-5", () => {
    const result = extractInfoFromText(
      "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
    );
    expect(result.description).toBe("Line 2 Line 3 Line 4 Line 5");
  });

  it("extracts date in DD-MM-YYYY format", () => {
    const result = extractInfoFromText("Activity\n01-01-2024");
    expect(result.date).toBe("01-01-2024");
  });

  it("extracts date in YYYY-MM-DD format", () => {
    const result = extractInfoFromText("Activity\n2024-01-01");
    expect(result.date).toBe("2024-01-01");
  });

  it("falls back to current date when no date found", () => {
    const result = extractInfoFromText("Activity without date");
    expect(result.date).toBe(new Date().toISOString().split("T")[0]);
  });

  it("truncates name to 100 chars", () => {
    const longName = "a".repeat(200);
    const result = extractInfoFromText(longName);
    expect(result.name).toHaveLength(100);
  });

  it("truncates description to 300 chars", () => {
    const lines = ["a".repeat(200), "b".repeat(200), "c".repeat(200)];
    const result = extractInfoFromText(lines.join("\n"));
    expect(result.description).toHaveLength(300);
  });
});
