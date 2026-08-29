import { AdminLayout } from "@/components/AdminLayout";
import { SimpleTableAdmin } from "@/components/admin/SimpleTableAdmin";

import { CSVTools } from "@/components/CSVTools";
export default function AdminCourseFees() {
  return (
    <AdminLayout title="Course Fees">
      <div className="mb-4">
        <CSVTools table="course_fees" filename="course_fees.csv" columns="*" upsertKey="id" />
      </div>

      <p className="text-sm text-muted-foreground mb-4">Per-college course fees. Pick from the directory or add manually.</p>
      <SimpleTableAdmin
        table="course_fees"
        titleKey="course_name"
        subtitleKey="college_slug"
        defaultValues={{ college_slug: "", course_slug: "", course_name: "", course_group: "", specialization: "", fee_amount: 0, fee_type: "Annual", year: "" }}
        ioColumns={["college_slug","course_slug","course_name","course_group","specialization","fee_amount","fee_type","year"]}
        ioTypeHints={{ fee_amount: "number" }}
        fields={[
          { key: "college_slug", label: "College Slug", required: true },
          { key: "course_slug", label: "Course Slug", required: true },
          { key: "course_group", label: "Broad Course / Degree", required: true, type: "combobox", options: ["B.E. / B.Tech", "M.E. / M.Tech", "MBA / PGDM", "BBA", "BCA", "MCA", "B.Com", "M.Com", "B.Sc.", "M.Sc.", "BA", "MA", "MBBS", "BDS", "B.Pharm", "M.Pharm", "LL.B.", "LL.M.", "B.Arch", "M.Arch", "Ph.D.", "Diploma"] },
          { key: "specialization", label: "Specialization", placeholder: "Computer Science and Engineering" },
          { key: "course_name", label: "Course Name (display)" },
          { key: "fee_amount", label: "Fee Amount", type: "number" },
          { key: "fee_type", label: "Fee Type", placeholder: "Annual / Total / Semester" },
          { key: "year", label: "Year", placeholder: "2024-25" },
        ]}
      />
    </AdminLayout>
  );
}
