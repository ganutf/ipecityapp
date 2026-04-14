import { motion } from "framer-motion";
import { Mail, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";

interface EmailStepProps {
  onComplete: () => void;
}

export function EmailStep({ onComplete }: EmailStepProps) {
  const { member, memberId } = useAuth();
  const isVerified = member?.emailVerified || false;

  if (isVerified) {
    return (
      <div className="text-center space-y-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <CheckCircle className="h-14 w-14 text-lime-500 mx-auto" />
        </motion.div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Email Verified</h2>
          <p className="text-sm text-gray-500">{member?.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Mail className="h-8 w-8 text-slate-900" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Verify Your Email</h2>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          We'll send a 6-digit code to confirm your email address.
        </p>
      </div>
      <div className="max-w-sm mx-auto">
        <EmailVerificationSection
          memberId={memberId || 0}
          currentEmail={member?.email || ""}
          isVerified={false}
          onVerificationComplete={onComplete}
          allowChange={false}
        />
      </div>
    </div>
  );
}
