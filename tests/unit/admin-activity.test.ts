import { describe, expect, it } from "vitest";
import { activityCsv, parseActivityFilter } from "@/lib/admin/activity";

describe("activity filters", () => {
  it("validates administrator IDs and UTC date ranges", () => {
    expect(parseActivityFilter({ from: "2024-02-29", to: "2024-03-01", q: " update " }).filter?.query).toBe("update");
    expect(parseActivityFilter({ admin: "invalid" }).error).toBeDefined();
    expect(parseActivityFilter({ from: "2023-02-29" }).error).toBeDefined();
    expect(parseActivityFilter({ from: "2024-03-01", to: "2024-02-01" }).error).toBeDefined();
    expect(parseActivityFilter({ action: ["create", "delete"] }).error).toBeDefined();
  });
  it("neutralizes spreadsheet formulas and quotes CSV", () => {
    const csv = activityCsv([{ id: "1", admin_user_id: null, action: "update", entity_type: "products", entity_id: null, description: '=CMD("x")', metadata: {}, created_at: "2024-01-01T00:00:00Z" }], true);
    expect(csv).toContain(`"'=CMD(""x"")"`);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
