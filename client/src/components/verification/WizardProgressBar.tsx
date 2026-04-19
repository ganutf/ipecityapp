import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepId = "wallet" | "email" | "profile" | "passport";

export interface WizardStep {
  id: StepId;
  label: string;
  isComplete: boolean;
}

interface WizardProgressBarProps {
  steps: WizardStep[];
  activeStepId: StepId | "complete";
  onStepClick?: (id: StepId) => void;
}

export function WizardProgressBar({ steps, activeStepId, onStepClick }: WizardProgressBarProps) {
  const naturalIdx = steps.findIndex((s) => !s.isComplete);
  const furthestReachable = naturalIdx === -1 ? steps.length - 1 : naturalIdx;

  return (
    <div className="flex items-center w-full max-w-sm mx-auto">
      {steps.map((step, index) => {
        const isActive = step.id === activeStepId;
        const canNavigate = !!onStepClick && index <= furthestReachable;

        const circleClasses = cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-500",
          step.isComplete && "bg-lime-500 text-white",
          isActive && !step.isComplete && "bg-slate-900 text-white ring-2 ring-lime-300/60 ring-offset-2",
          !isActive && !step.isComplete && "bg-gray-200 text-gray-400",
          canNavigate && "cursor-pointer hover:opacity-80",
        );

        const labelClasses = cn(
          "text-xs mt-2 font-medium transition-colors duration-500",
          step.isComplete
            ? "text-lime-700"
            : isActive
              ? "text-slate-900"
              : "text-gray-400",
        );

        const stepContent = (
          <>
            <div className={circleClasses}>
              {step.isComplete ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span className={labelClasses}>{step.label}</span>
          </>
        );

        return (
          <Fragment key={step.id}>
            {canNavigate ? (
              <button
                type="button"
                onClick={() => onStepClick!(step.id)}
                className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 rounded-lg"
                aria-current={isActive ? "step" : undefined}
              >
                {stepContent}
              </button>
            ) : (
              <div className="flex flex-col items-center">{stepContent}</div>
            )}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-3 mb-5 transition-colors duration-500",
                  step.isComplete ? "bg-lime-500" : "bg-gray-200",
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
