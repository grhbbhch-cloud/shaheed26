import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let msg = error.message || 'حدث خطأ غير متوقع في عرض التطبيق.';
    try {
      const parsed = JSON.parse(msg);
      if (parsed && typeof parsed === 'object' && parsed.error) {
        msg = `خطأ في المزامنة (${parsed.operationType || 'write'}): ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, errorMessage: msg };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught UI error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-[#FAF7F0] text-[#171717] p-6"
        >
          <div className="max-w-md w-full bg-white border border-[#DECBA0] rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-[#0A1C13]">حدث خطأ مؤقت في الواجهة</h1>
            <p className="text-sm text-neutral-600 leading-relaxed break-words">
              {this.state.errorMessage}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-bold hover:bg-[#0F3F22] transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة تحميل الصفحة
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition"
              >
                العودة للرئيسية
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
