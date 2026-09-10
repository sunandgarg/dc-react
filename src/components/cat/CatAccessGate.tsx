import { LeadGateDialog } from "@/components/LeadGateDialog";
import { saveCatAccess } from "@/lib/catExperience";

type CatAccessGateProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGranted: (leadId: string) => void;
  source: string;
  title: string;
};

const catGoals = [
  "CAT 2026 preparation",
  "IIM interview preparation",
  "MBA college selection",
  "Other MBA entrance preparation",
];

export function CatAccessGate({ open, onOpenChange, onGranted, source, title }: CatAccessGateProps) {
  return (
    <LeadGateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle="Two quick steps, then the complete 16-resource ZIP starts downloading."
      source={source}
      forceShow
      simple
      interestLabel="CAT goal"
      interestOptions={catGoals}
      interestedExamSlug="cat"
      theme="cat-kit"
      onSuccess={(leadId) => {
        if (!leadId) return;
        saveCatAccess(leadId);
        onGranted(leadId);
        onOpenChange(false);
      }}
    />
  );
}
