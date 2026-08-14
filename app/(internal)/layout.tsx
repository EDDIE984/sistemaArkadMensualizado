import { InternalHeader } from "@/components/internal/internal-header";
import { requireSession } from "@/lib/auth/session";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="internal-background min-h-dvh text-white">
      <InternalHeader session={session} />
      {children}
    </div>
  );
}
