import { describe, expect, it } from "vitest";
import { groupLeadsByIdentity } from "./leadIdentity";

describe("lead identity grouping", () => {
  it("groups by either normalized phone or case-insensitive email and keeps the latest enquiry first", () => {
    const rows = [
      { id: "old", phone: "+91 99900 10001", email: "person@example.com", created_at: "2026-08-01T10:00:00Z", course: "MBA" },
      { id: "latest", phone: "9990010001", email: "PERSON@EXAMPLE.COM", created_at: "2026-08-11T10:00:00Z", course: "B.Tech" },
      { id: "other", phone: "8880010001", email: "other@example.com", created_at: "2026-08-12T10:00:00Z", course: "BBA" },
    ];

    const groups = groupLeadsByIdentity(rows);

    expect(groups).toHaveLength(2);
    const repeated = groups.find((group) => group.instances.length === 2)!;
    expect(repeated.primary.id).toBe("latest");
    expect(repeated.instances.map((lead) => lead.id)).toEqual(["latest", "old"]);
  });

  it("joins bridge records without combining leads that have no usable identity", () => {
    const rows = [
      { id: "phone", phone: "9990010001", email: "", created_at: "2026-08-01" },
      { id: "email", phone: "", email: "person@example.com", created_at: "2026-08-02" },
      { id: "bridge", phone: "9990010001", email: "person@example.com", created_at: "2026-08-03" },
      { id: "anonymous-a", phone: "123", email: "", created_at: "2026-08-04" },
      { id: "anonymous-b", phone: "123", email: "", created_at: "2026-08-05" },
    ];

    const groups = groupLeadsByIdentity(rows);

    expect(groups.map((group) => group.instances.length).sort()).toEqual([1, 1, 3]);
  });
});
