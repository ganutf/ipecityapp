import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

interface ProfileCardProps {
  children: ReactNode;
}

export function ProfileCard({ children }: ProfileCardProps) {
  return (
    <Card className="border-l-4 border-l-slate-700 bg-white shadow-sm">
      {children}
    </Card>
  );
}