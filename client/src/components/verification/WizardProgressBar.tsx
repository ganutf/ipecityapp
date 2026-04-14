import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepId = "wallet" | "email" | "passport";

export interface WizardStep {
  id: StepId;
  label: string;
  isComplete: boolean;
}

interface WizardProgressBarProps {
  steps: WizardStep[];
  activeStepId: StepId | "complete";
}

export function WizardProgressBar({ steps, activeStepId }: WizardProgressBarProps) {
  return (
    <div className="flex items-center w-full max-w-sm mx-auto">
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-500",
                step.isComplete && "bg-lime-500 text-white",
                step.id === activeStepId &&
                  !step.isComplete &&
                  "bg-slate-900 text-white ring-2 ring-lime-300/60 ring-offset-2",
                step.id !== activeStepId &&
                  !step.isComplete &&
                  "bg-gray-200 text-gray-400"
              )}
            >
              {step.isComplete ? (
                <Check className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={cn(
                "text-xs mt-2 font-medium transition-colors duration-500",
                step.isComplete
                  ? "text-lime-700"
                  : step.id === activeStepId
                    ? "text-slate-900"
                    : "text-gray-400"
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-3 mb-5 transition-colors duration-500",
                step.isComplete ? "bg-lime-500" : "bg-gray-200"
              )}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
