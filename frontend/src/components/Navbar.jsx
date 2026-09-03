import { useAuth } from './AuthGate';

export default function Navbar({ onNewUpload }) {
  const { user, signOut, logout } = useAuth();

  const handleSignOutClick = async () => {
    if (signOut) {
      await signOut();
    } else if (logout) {
      await logout();
    }
  };

  return (
    <header className="bg-pure-white border-b border-mist sticky top-0 z-50 h-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={onNewUpload}
          className="flex items-center space-x-3 cursor-pointer select-none group"
          title="Return to Home"
        >
          {/* Iris Hexagon Icon Glyph */}
          <div className="w-9 h-9 rounded-control bg-iris flex items-center justify-center text-white shadow-subtle text-base font-black transition group-hover:scale-105">
            ⬡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-studio-slate tracking-tight">DocExtractor AI</h1>
              <span className="pill-badge !text-[11px] !py-0.5 !px-2.5 !shadow-none border border-mist bg-cloud text-iron">
                <span className="w-1.5 h-1.5 rounded-full bg-iris animate-pulse"></span>
                <span>Specify UI</span>
              </span>
            </div>
          </div>
        </div>

        {/* User Profile & Actions */}
        {user && (
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-studio-slate truncate max-w-[220px]">
                {user.email}
              </span>
              <span className="text-[11px] text-iris font-medium">Enterprise Workspace</span>
            </div>

            <button
              type="button"
              onClick={handleSignOutClick}
              className="btn-pill-ghost !text-xs !py-1.5 !px-3.5 hover:!border-studio-slate"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
