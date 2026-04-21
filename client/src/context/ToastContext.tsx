import React, {createContext, useState, useCallback, ReactNode} from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextData {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
  toast: ToastOptions | null;
  visible: boolean;
}

export const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const ToastProvider = ({children}: {children: ReactNode}) => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback(({message, type = 'success', duration = 3000}: ToastOptions) => {
    setToast({message, type, duration});
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const hideToast = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <ToastContext.Provider value={{showToast, hideToast, toast, visible}}>
      {children}
    </ToastContext.Provider>
  );
};
