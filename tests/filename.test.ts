import { describe, expect, it } from "vitest";
import { contentDisposition, filenameFromDisposition, posterFilename } from "../src/lib/filename";

const base = {
  driverName: "Carlos SAINZ",
  eventName: "Singapore Grand Prix",
  year: 2023,
  sessionName: "Qualifying",
  lapNumber: 19,
  templateName: "Arcade Flyer",
  cropMarks: false,
};

describe("poster file names", () => {
  it("reads like a title", () => {
    expect(posterFilename(base, "png")).toBe("Carlos Sainz - Singapore Grand Prix 2023 - Qualifying - Lap 19 - Arcade Flyer.png");
  });
  it("marks the crop-mark version", () => {
    expect(posterFilename({ ...base, cropMarks: true }, "png")).toBe(
      "Carlos Sainz - Singapore Grand Prix 2023 - Qualifying - Lap 19 - Arcade Flyer (crop marks).png",
    );
  });
  it("does not repeat a year already in the event name", () => {
    expect(posterFilename({ ...base, eventName: "Malaysia 2026" }, "svg")).toContain(" - Malaysia 2026 - ");
  });
  it("strips characters that file systems reject", () => {
    expect(posterFilename({ ...base, eventName: 'São Paulo: "GP"/?' }, "png")).toBe("Carlos Sainz - São Paulo GP 2023 - Qualifying - Lap 19 - Arcade Flyer.png");
  });
  it("keeps accents through Content-Disposition", () => {
    const name = posterFilename({ ...base, driverName: "Nico HÜLKENBERG" }, "png");
    expect(name.startsWith("Nico Hülkenberg - ")).toBe(true);
    const header = contentDisposition(name);
    expect(header).toContain('filename="Nico Hulkenberg - ');
    expect(filenameFromDisposition(header)).toBe(name);
  });
});
