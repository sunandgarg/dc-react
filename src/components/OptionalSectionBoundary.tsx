import { Component, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  children: ReactNode;
  minHeight?: number;
  name: string;
}

interface State {
  hasError: boolean;
}

export class OptionalSectionBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[OptionalSectionBoundary:${this.props.name}]`, error);
    try {
      trackEvent("optional_section_error", {
        section: this.props.name,
        message: error.message,
        href: typeof window !== "undefined" ? window.location.href : undefined,
      });
    } catch {/* analytics must never affect page rendering */}
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ minHeight: this.props.minHeight ?? 0 }} aria-hidden="true" />;
    }

    return this.props.children;
  }
}
