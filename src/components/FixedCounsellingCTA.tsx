import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone } from "lucide-react";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";

export function FixedCounsellingCTA() {
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || submitted) return null;

  return (
    <div className="fixed left-0 right-0 z-40 md:left-4 md:right-auto md:w-[360px] dc-bottom-nav-aware-tight">
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="form"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="relative bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-elevated p-2"
          >
            <button
              type="button"
              aria-label="Close counselling form"
              onClick={() => setDismissed(true)}
              className="absolute right-3 top-3 z-10 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <LeadCaptureForm
              variant="card"
              title="Free Expert Counselling"
              subtitle="Get a callback from an admission expert"
              source="fixed_cta"
              simple
              onSuccess={() => setSubmitted(true)}
            />
          </motion.div>
        ) : (
          <motion.button
            key="bar"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            onClick={() => setExpanded(true)}
            className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-3.5 gradient-primary text-primary-foreground font-semibold text-sm rounded-t-2xl md:rounded-2xl shadow-glow hover:shadow-lg transition-shadow"
          >
            <Phone className="w-4 h-4" />
            Get Expert College Counselling - Free
            <span className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
