import { useAuth } from './AuthGate';

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md text-white font-bold text-lg">
            📑
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">DocExtractor AI</h1>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-gray-500 font-medium">Qwen & Multi-Threading Active</span>
            </div>
          </div>
        </div>

        {/* User Profile & Actions */}
        {user && (
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-gray-800 truncate max-w-[200px]">
                {user.email}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">Authenticated</span>
            </div>

            <button
              onClick={signOut}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 border border-gray-300 hover:border-red-200 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
