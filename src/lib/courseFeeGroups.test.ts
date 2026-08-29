import { describe, expect, it } from "vitest";
import { formatFeeRange, groupCollegeFees, inferCourseGroup, inferCourseSpecialization, normalizeCourseDisplayName } from "./courseFeeGroups";

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

  it("groups legacy Amity-style rows even when broad course fields are blank", () => {
    const groups = groupCollegeFees([
      { course_name: "B.Sc. (Hons) - Mathematics", fee_amount: 200000 },
      { course_name: "B.Sc. (Hons) - Biotechnology", fee_amount: 350000 },
      { course_name: "B.Des in Fashion Design", fee_amount: 600000 },
      { course_name: "Bachelor of Interior Design", fee_amount: 500000 },
      { course_name: "B.El.Ed. (Bachelor of Elementary Education)", fee_amount: 250000 },
    ]);

    expect(groups.map((group) => group.label)).toEqual(["B.Des", "B.Ed", "B.Sc."]);
    expect(groups.find((group) => group.label === "B.Des")?.specializationCount).toBe(2);
    expect(groups.find((group) => group.label === "B.Sc.")?.specializationCount).toBe(2);
  });

  it("normalizes writer-entered course casing while preserving degree acronyms", () => {
    expect(normalizeCourseDisplayName("btech in computer science and engineering")).toBe("B.Tech in Computer Science and Engineering");
    expect(normalizeCourseDisplayName("mba international business")).toBe("MBA International Business");
  });

  it("repairs legacy rows that copied the full course name into specialization", () => {
    expect(inferCourseSpecialization({ course_name: "MCA", specialization: "MCA" })).toBe("General");
    expect(inferCourseSpecialization({ course_name: "B.Sc. (Hons) - Mathematics", specialization: "B.Sc. (Hons) - Mathematics" })).toBe("Mathematics");
  });
});
