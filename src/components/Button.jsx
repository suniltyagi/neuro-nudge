export default function Button({ children, onClick, type='button', className='' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2
                  bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  transition ${className}`}
    >
      {children}
    </button>
  );
}
