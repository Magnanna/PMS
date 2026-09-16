import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvWithHeader } from "../csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated file", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('name,note\n"Kamau, John",hello')).toEqual([
      ["name", "note"],
      ["Kamau, John", "hello"],
    ]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    expect(parseCsv('note\n"She said ""hi"""')).toEqual([["note"], ['She said "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input (negative/edge case)", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseCsvWithHeader", () => {
  it("keys each row by the header names", () => {
    expect(parseCsvWithHeader("name,rent\nA1,30000")).toEqual([{ name: "A1", rent: "30000" }]);
  });

  it("returns an empty array when there's only a header row", () => {
    expect(parseCsvWithHeader("name,rent")).toEqual([]);
  });

  it("fills missing trailing columns with an empty string", () => {
    expect(parseCsvWithHeader("a,b,c\n1")).toEqual([{ a: "1", b: "", c: "" }]);
  });
});
