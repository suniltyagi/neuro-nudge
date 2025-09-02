export default function Panel({ title, children, className = '' }) {
  return (
    <section className={`max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 ${className}`}>
      {title && (
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
        </header>
      )}
      <div className="rounded-2xl border border-gray-200 p-4 shadow-sm bg-white dark:bg-gray-900 dark:border-gray-800">
        {children}
      </div>
    </section>
  );
}
