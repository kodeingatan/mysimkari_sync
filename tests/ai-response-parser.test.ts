import { describe, expect, it } from "vitest";
import {
  extractAiText,
  parseAiResponse,
} from "../electron/ai-response-parser";

describe("extractAiText", () => {
  it("returns a trimmed direct string", () => {
    expect(extractAiText("  generated text  ")).toBe("generated text");
  });

  it("returns an empty string for unsupported values", () => {
    expect(extractAiText(null)).toBe("");
    expect(extractAiText(undefined)).toBe("");
    expect(extractAiText(42)).toBe("");
    expect(extractAiText({ status: "done" })).toBe("");
  });

  it("extracts nested Gemini output text", () => {
    const response = {
      outputs: [{ type: "text", text: "  NAMA: Kegiatan Sosialisasi" }],
    };

    expect(extractAiText(response)).toBe("NAMA: Kegiatan Sosialisasi");
  });

  it("supports output_text and deeply nested content", () => {
    const response = {
      response: {
        candidates: [{ content: { parts: [{ output_text: "Nested result" }] } }],
      },
    };

    expect(extractAiText(response)).toBe("Nested result");
  });

  it("joins multiple text fragments", () => {
    const response = {
      outputs: [{ text: "First" }, { text: "Second" }],
    };

    expect(extractAiText(response)).toBe("First\nSecond");
  });

  it("prefers typed text outputs over non-text outputs", () => {
    const response = {
      outputs: [
        { type: "image", text: "not the generated answer" },
        { type: "text", text: "Generated answer" },
      ],
    };

    expect(extractAiText(response)).toBe("Generated answer");
  });
});

describe("parseAiResponse", () => {
  it("parses a fenced JSON response", () => {
    expect(
      parseAiResponse(
        '```json\n{"name":"  Nama Kegiatan ","description":" Deskripsi kegiatan "}\n```',
        "both",
      ),
    ).toEqual({ name: "Nama Kegiatan", description: "Deskripsi kegiatan" });
  });

  it("returns only the requested field for a single-target JSON response", () => {
    const response = parseAiResponse(
      '{"name":"Generated name","description":"Generated description"}',
      "name",
    );

    expect(response).toEqual({ name: "Generated name" });
  });

  it("parses labeled name and description responses", () => {
    expect(
      parseAiResponse("nama: Nama kegiatan\ndeskripsi: Deskripsi kegiatan", "both"),
    ).toEqual({ name: "Nama kegiatan", description: "Deskripsi kegiatan" });
  });

  it("keeps missing fields undefined for incomplete both responses", () => {
    expect(parseAiResponse("NAMA: Only a name", "both")).toEqual({
      name: "Only a name",
      description: undefined,
    });
  });

  it("parses plain text for a single target", () => {
    expect(parseAiResponse("  Generated name  ", "name")).toEqual({
      name: "Generated name",
    });
    expect(parseAiResponse("  Generated description  ", "description")).toEqual({
      description: "Generated description",
    });
  });

  it("truncates generated fields to form limits", () => {
    expect(parseAiResponse("a".repeat(101), "name").name).toHaveLength(100);
    expect(parseAiResponse("b".repeat(301), "description").description).toHaveLength(300);
  });

  it("returns empty fields for blank input", () => {
    expect(parseAiResponse("", "name")).toEqual({ name: "" });
    expect(parseAiResponse("", "description")).toEqual({ description: "" });
    expect(parseAiResponse("", "both")).toEqual({
      name: undefined,
      description: undefined,
    });
  });
});
