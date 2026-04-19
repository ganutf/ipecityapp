import { useEffect, useRef, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { WizardProgressBar, type WizardStep, type StepId } from "./WizardProgressBar";
import { WalletStep } from "./WalletStep";
import { EmailStep } from "./EmailStep";
import { PassportStep } from "./PassportStep";
import { CompletionStep } from "./CompletionStep";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

const STEP_LABELS: Record<StepId, string> = {
  wallet: "Wallet",
  email: "Email",
  passport: "Passport",
};

function useVerificationSteps(
  member: ReturnType<typeof useAuth>["member"],
  stepOrder: StepId[]
) {
  const steps: WizardStep[] = useMemo(() => {
    const completionById: Record<StepId, boolean> = {
      wallet: !!member?.walletAddress,
      email: !!member?.emailVerified,
      // Only active_member is a terminal state. Earlier states (pending review,
      // approved but not yet ENS-verified) still need action in the passport step.
      passport: member?.status === "active_member",
    };

    return stepOrder.map((id) => ({
      id,
      label: STEP_LABELS[id],
      isComplete: completionById[id],
    }));
  }, [member?.walletAddress, member?.emailVerified, member?.status, stepOrder]);

  const currentStepIndex = steps.findIndex((s) => !s.isComplete);
  const allComplete = currentStepIndex === -1;
  const naturalActiveStep: StepId | "complete" = allComplete
    ? "complete"
    : steps[currentStepIndex].id;

  const completedCount = steps.filter((s) => s.isComplete).length;

  return { steps, naturalActiveStep, allComplete, completedCount };
}

export function VerificationWizard() {
  const {
    member,
    memberId,
    isMemberLoading,
    memberStatus,
    isAuthenticated,
    refreshMember,
  } = useAuth();
  const [, setLocation] = useLocation();

  // Freeze step order at first render where we have enough signal to detect
  // signup method. For email signups the wallet step is still pending, so we
  // want to surface it as step 2 after the already-done email step.
  const [stepOrder, setStepOrder] = useState<StepId[] | null>(null);
  useEffect(() => {
    if (stepOrder || isMemberLoading || !member) return;
    if (member.emailVerified && !member.walletAddress) {
      setStepOrder(["email", "wallet", "passport"]);
    } else {
      setStepOrder(["wallet", "email", "passport"]);
    }
  }, [stepOrder, member, isMemberLoading]);

  const effectiveOrder = stepOrder ?? ["wallet", "email", "passport"];

  const { steps, naturalActiveStep, allComplete, completedCount } =
    useVerificationSteps(member, effectiveOrder);

  // User-selected step override via progress-bar click. Null means follow the
  // natural progression (first-incomplete step).
  const [selectedStep, setSelectedStep] = useState<StepId | null>(null);

  // Drop the override once the user progresses past the step they clicked
  // into, so the wizard doesn't get stuck on a stale override after the
  // underlying state advances (e.g. after they finish editing and come back).
  useEffect(() => {
    if (!selectedStep) return;
    const selectedIdx = steps.findIndex((s) => s.id === selectedStep);
    const naturalIdx = steps.findIndex((s) => !s.isComplete);
    const effectiveNaturalIdx = naturalIdx === -1 ? steps.length : naturalIdx;
    if (selectedIdx < 0 || selectedIdx > effectiveNaturalIdx) {
      setSelectedStep(null);
    }
  }, [selectedStep, steps]);

  const activeStep: StepId | "complete" = selectedStep ?? naturalActiveStep;

  const handleStepClick = (id: StepId) => {
    const idx = steps.findIndex((s) => s.id === id);
    const naturalIdx = steps.findIndex((s) => !s.isComplete);
    const effectiveNaturalIdx = naturalIdx === -1 ? steps.length - 1 : naturalIdx;
    if (idx < 0 || idx > effectiveNaturalIdx) return;
    // Clicking the natural step returns to auto-follow mode.
    setSelectedStep(idx === effectiveNaturalIdx && naturalIdx !== -1 ? null : id);
  };

  const prevStepRef = useRef(activeStep);
  const directionRef = useRef(1);

  // Track direction for animation
  useEffect(() => {
    const stepOrderForAnimation: (StepId | "complete")[] = [...effectiveOrder, "complete"];
    const prevIndex = stepOrderForAnimation.indexOf(prevStepRef.current);
    const currentIndex = stepOrderForAnimation.indexOf(activeStep);
    directionRef.current = currentIndex >= prevIndex ? 1 : -1;
    prevStepRef.current = activeStep;
  }, [activeStep, effectiveOrder]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isMemberLoading) {
      setLocation("/");
    }
  }, [isAuthenticated, isMemberLoading, setLocation]);

  // Redirect if already active member
  useEffect(() => {
    if (memberStatus === "active_member") {
      // Brief delay to show completion state
      const timer = setTimeout(() => setLocation("/"), 2000);
      return () => clearTimeout(timer);
    }
  }, [memberStatus, setLocation]);

  if (isMemberLoading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const stepLabel =
    activeStep === "complete"
      ? "All steps complete"
      : `${completedCount} of ${steps.length} complete`;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto max-w-xl px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="mx-auto w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-3">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">ID Verification</h1>
          <p className="text-sm text-gray-500">{stepLabel}</p>
        </div>

        {/* Progress Bar */}
        <WizardProgressBar
          steps={steps}
          activeStepId={activeStep}
          onStepClick={handleStepClick}
        />

        {/* Step Content */}
        <Card className="bg-white shadow-sm border-0 shadow-gray-200/60">
          <CardContent className="p-8">
            <AnimatePresence mode="wait" custom={directionRef.current}>
              <motion.div
                key={activeStep}
                custom={directionRef.current}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {activeStep === "wallet" && (
                  <WalletStep onContinue={() => setSelectedStep(null)} />
                )}
                {activeStep === "email" && (
                  <EmailStep onComplete={refreshMember} />
                )}
                {activeStep === "passport" && (
                  <PassportStep onComplete={refreshMember} />
                )}
                {activeStep === "complete" && <CompletionStep />}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
