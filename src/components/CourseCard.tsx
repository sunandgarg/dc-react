import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Building, TrendingUp, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DbCourse } from "@/hooks/useCoursesData";
import { PriorityBadge } from "@/components/PriorityBadge";
import { buildCourseHref } from "@/lib/entityUrls";
import { compactDisplayText, displayText } from "@/lib/displayText";

interface CourseCardProps {
  course: DbCourse;
  index: number;
}

export function CourseCard({ course, index }: CourseCardProps) {
  const category = compactDisplayText(course.category, "General", 34);
  const level = compactDisplayText(course.level, "Course", 28);
  const mode = compactDisplayText(course.mode, "Full-Time", 24);
  const fullName = displayText(course.full_name);
  const specializations = (course.specializations || []).map((item) => compactDisplayText(item, "", 28)).filter(Boolean);
  const duration = compactDisplayText(course.duration, "-", 18);
  const collegesCount = Number(course.colleges_count || 0);
  const growth = compactDisplayText(course.growth, "-", 24);
  const avgSalary = compactDisplayText(course.avg_salary, "-", 24);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 5) * 0.04, duration: 0.3 }}
    >
      <Link to={buildCourseHref(course)} className="block h-full">
        <article className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
          <div className="relative">
            <img src={course.image} alt={`${course.name} course`} width="640" height="360" className="w-full h-40 object-cover flex-shrink-0" loading="lazy" decoding="async" />
            <div className="absolute top-2 left-2"><PriorityBadge priority={(course as any).priority} /></div>
          </div>
          <div className="p-4 flex-1 flex flex-col">
            {/* Tags */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="max-w-full truncate text-xs">{category}</Badge>
              <Badge variant="outline" className="max-w-full truncate text-xs">{level}</Badge>
              <Badge variant="outline" className="max-w-full truncate border-primary/30 text-xs text-primary">{mode}</Badge>
            </div>

            <h2 className="text-base font-bold text-foreground mb-1 line-clamp-2">{displayText(course.name, "Course")}</h2>
            {fullName && fullName !== displayText(course.name) && <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{fullName}</p>}

            {/* Specializations */}
            {specializations.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {specializations.slice(0, 3).map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary font-medium">
                    {s}
                  </span>
                ))}
                {specializations.length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    +{specializations.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground">{duration}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground">{collegesCount} colleges</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                <span className="text-xs font-semibold text-success">{growth}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground">{avgSalary}</span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
