import React, { createContext, useContext, useState } from 'react';

interface SidebarContextValue {
  isSidebarOpen: boolean;
  sidebarContent: React.ReactNode;
  openSidebar: (content: React.ReactNode) => void;
  closeSidebar: () => void;
  toggleSidebar: (content?: React.ReactNode) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<React.ReactNode>(null);

  const openSidebar = (content: React.ReactNode) => {
    setSidebarContent(content);
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = (content?: React.ReactNode) => {
    if (isSidebarOpen) {
      closeSidebar();
    } else if (content) {
      openSidebar(content);
    }
  };

  return (
    <SidebarContext.Provider value={{
      isSidebarOpen,
      sidebarContent,
      openSidebar,
      closeSidebar,
      toggleSidebar
    }}>
      {children}
    </SidebarContext.Provider>
  );
};