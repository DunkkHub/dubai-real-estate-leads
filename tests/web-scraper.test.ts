import { describe, expect, it } from "vitest";
import { isAllowedByRobots } from "../src/lib/sources/web";

describe("public web scraper robots handling", () => {
  it("blocks disallowed paths", () => {
    const robots = `
      User-agent: *
      Disallow: /private
      Allow: /private/public-info
    `;

    expect(isAllowedByRobots(robots, "/private/lead-list")).toBe(false);
    expect(isAllowedByRobots(robots, "/private/public-info/dubai")).toBe(true);
  });

  it("allows public paths when no disallow rule matches", () => {
    const robots = `
      User-agent: *
      Disallow: /admin
    `;

    expect(isAllowedByRobots(robots, "/dubai-property-investment")).toBe(true);
  });
});
