import { useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { useEnsLookup } from "@/hooks/useEnsLookup";
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

function useVerificationSteps(
  member: ReturnType<typeof useAuth>["member"],
  isWalletConnected: boolean,
  hasSubdomainFromEns: boolean
) {
  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: "wallet" as StepId,
        label: "Wallet",
        isComplete: !!member?.walletAddress || isWalletConnected,
      },
      {
        id: "email" as StepId,
        label: "Email",
        isComplete: !!member?.emailVerified,
      },
      {
        id: "passport" as StepId,
        label: "Passport",
        isComplete:
          !!member?.ipePassport ||
          member?.status === "active_member" ||
          hasSubdomainFromEns,
      },
    ],
    [member?.walletAddress, member?.emailVerified, member?.ipePassport, member?.status, isWalletConnected, hasSubdomainFromEns]
  );

  const currentStepIndex = steps.findIndex((s) => !s.isComplete);
  const allComplete = currentStepIndex === -1;
  const activeStep: StepId | "complete" = allComplete
    ? "complete"
    : steps[currentStepIndex].id;

  const completedCount = steps.filter((s) => s.isComplete).length;

  return { steps, activeStep, allComplete, completedCount };
}

export function VerificationWizard() {
  const {
    member,
    memberId,
    isMemberLoading,
    memberStatus,
    isAuthenticated,
    refreshMember,
    getAccessToken,
  } = useAuth();
  const [, setLocation] = useLocation();

  const { activeWallet } = useActiveWallet();
  const address = activeWallet?.address as `0x${string}` | undefined;
  const isConnected = !!activeWallet;

  const walletForLookup = address || member?.walletAddress;
  const { ensNames } = useEnsLookup(walletForLookup || "");
  const hasSubdomainFromEns = ensNames && ensNames.length > 0;

  const { steps, activeStep, allComplete, completedCount } =
    useVerificationSteps(member, isConnected, hasSubdomainFromEns);

  const prevStepRef = useRef(activeStep);
  const directionRef = useRef(1);

  // Track direction for animation
  useEffect(() => {
    const stepOrder: (StepId | "complete")[] = ["wallet", "email", "passport", "complete"];
    const prevIndex = stepOrder.indexOf(prevStepRef.current);
    const currentIndex = stepOrder.indexOf(activeStep);
    directionRef.current = currentIndex >= prevIndex ? 1 : -1;
    prevStepRef.current = activeStep;
  }, [activeStep]);

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

  // Save wallet address when connected via Privy
  useEffect(() => {
    const saveWalletAddress = async () => {
      if (
        isConnected &&
        address &&
        memberId &&
        address.toLowerCase() !== member?.walletAddress?.toLowerCase()
      ) {
        try {
          const token = await getAccessToken();
          if (!token) return;
          const response = await fetch(`/api/v2/members/${memberId}/wallet`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ walletAddress: address }),
          });
          if (response.ok) {
            refreshMember();
          }
        } catch {
          // Wallet save failed silently
        }
      }
    };
    saveWalletAddress();
  }, [isConnected, address, memberId, member?.walletAddress, refreshMember, getAccessToken]);

  if (isMemberLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const stepLabel =
    activeStep === "complete"
      ? "Complete"
      : `Step ${completedCount + 1} of ${steps.length}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
        <WizardProgressBar steps={steps} activeStepId={activeStep} />

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
                {activeStep === "wallet" && <WalletStep />}
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
