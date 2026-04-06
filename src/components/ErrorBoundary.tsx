import * as React from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends (React.Component as any) {
  state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = "Something went wrong. Please try again later.";
      let isQuotaError = false;

      try {
        if (error?.name === 'FirestoreQuotaError') {
          isQuotaError = true;
          const errorData = JSON.parse(error.message);
          errorMessage = errorData.error;
        } else if (error?.message.includes('resource-exhausted') || error?.message.includes('Quota limit exceeded')) {
          isQuotaError = true;
          errorMessage = "Firestore Quota Exceeded. Please wait until tomorrow for the free tier to reset.";
        }
      } catch (e) {
        // Fallback if parsing fails
      }

      return (
        <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-[3rem] p-10 text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tighter uppercase text-red-600">
                {isQuotaError ? "Quota Exceeded" : "Oops! Error"}
              </h1>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full flex items-center justify-center hover:scale-105 transition-transform"
            >
              <RefreshCcw size={18} className="mr-2" />
              Reload Page
            </button>
            
            {isQuotaError && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                This is a temporary limit of the free tier.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
