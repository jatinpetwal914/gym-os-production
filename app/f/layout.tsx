import { AmbientBackground } from '@/components/visual/ambient-background';

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#F4F7FA] text-slate-800">
      <AmbientBackground />
      <div className="relative">{children}</div>
    </div>
  );
}
