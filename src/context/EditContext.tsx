import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface EditContextType {
  canEdit: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
}

const EditContext = createContext<EditContextType | null>(null);

// Simple password - you can change this or move to env var
const EDIT_PASSWORD = 'renderspace2024';

export function EditProvider({ children }: { children: ReactNode }) {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    // Check if already unlocked in session
    const unlocked = sessionStorage.getItem('edit_unlocked');
    if (unlocked === 'true') {
      setCanEdit(true);
    }
  }, []);

  function unlock(password: string): boolean {
    if (password === EDIT_PASSWORD) {
      setCanEdit(true);
      sessionStorage.setItem('edit_unlocked', 'true');
      return true;
    }
    return false;
  }

  function lock() {
    setCanEdit(false);
    sessionStorage.removeItem('edit_unlocked');
  }

  return (
    <EditContext.Provider value={{ canEdit, unlock, lock }}>
      {children}
    </EditContext.Provider>
  );
}

export function useEdit() {
  const context = useContext(EditContext);
  if (!context) {
    throw new Error('useEdit must be used within EditProvider');
  }
  return context;
}
