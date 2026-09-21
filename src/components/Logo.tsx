export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-10 w-10 text-base' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  const text = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex ${box} items-center justify-center rounded-fleet bg-fleet-inverse font-bold text-white dark:text-fleet-text`}>£</span>
      <span className={`${text} font-semibold tracking-tight`}>
        Pitch <span className="text-fleet-muted">Money</span>
      </span>
    </div>
  );
}
