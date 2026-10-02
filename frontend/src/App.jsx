import { Toaster, ToastBar, toast } from "react-hot-toast";
import { X } from "lucide-react";
import AppRoutes from "./routes";
import { ThemeProvider } from "./components/ThemeProvider";

function App() {
  return (
    <ThemeProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <div className="flex items-center gap-2 w-full">
                {icon}
                <div className="text-xs font-semibold leading-normal flex-1">{message}</div>
                {t.type !== "loading" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.dismiss(t.id);
                    }}
                    aria-label="Dismiss notification"
                    className="ml-2 -mr-1 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer inline-flex items-center justify-center shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        )}
      </Toaster>

      <AppRoutes />
    </ThemeProvider>
  );
}

export default App;