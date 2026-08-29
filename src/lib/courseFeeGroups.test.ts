import { describe, expect, it } from "vitest";
import { formatFeeRange, groupCollegeFees, inferCourseGroup, inferCourseSpecialization } from "./courseFeeGroups";

describe("course fee grouping", () => {
  it("groups specializations under a broad degree and calculates its fee range", () => {
    const groups = groupCollegeFees([
      { id: "1", course_name: "B.Tech Computer Science", course_slug: "btech-cse", fee_amount: 450000, fee_type: "Total Course" },
      { id: "2", course_name: "B.Tech Mechanical Engineering", course_slug: "btech-me", fee_amount: 800000, fee_type: "Total Course" },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("B.E. / B.Tech");
    expect(groups[0].specializationCount).toBe(2);
    expect(formatFeeRange(groups[0])).toBe("₹4.5 L - ₹8 L");
  });

  it("prefers explicit writer-entered grouping and specialization", () => {
    const row = { course_group: "MBA / PGDM", specialization: "Finance", course_name: "Management programme" };
    expect(inferCourseGroup(row)).toBe("MBA / PGDM");
    expect(inferCourseSpecialization(row)).toBe("Finance");
  });

  it("searches both degree names and child specializations", () => {
    const rows = [
      { course_group: "B.E. / B.Tech", specialization: "Artificial Intelligence", fee_amount: 500000 },
      { course_group: "MBA / PGDM", specialization: "Marketing", fee_amount: 300000 },
    ];
    expect(groupCollegeFees(rows, "artificial").map((group) => group.label)).toEqual(["B.E. / B.Tech"]);
    expect(groupCollegeFees(rows, "mba").map((group) => group.label)).toEqual(["MBA / PGDM"]);
  });

  it("does not treat an unset zero fee as the low end of a range", () => {
    const [group] = groupCollegeFees([
      { course_group: "B.E. / B.Tech", specialization: "Civil", fee_amount: 0 },
      { course_group: "B.E. / B.Tech", specialization: "Mechanical", fee_amount: 600000 },
    ]);
    expect(formatFeeRange(group)).toBe("₹6 L");
  });
});
