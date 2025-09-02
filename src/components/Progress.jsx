export default function Progress({ value = 0 }) {
  const w = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
      <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${w}%` }} />
    </div>
  );
}
