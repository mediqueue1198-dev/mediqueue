import { create } from 'zustand'

export interface UiState {
  sidebarOpen: boolean;
  activeModal: string | null;
  modalData: any | null;
  theme: 'light' | 'dark';
  isFullscreen: boolean;

  toggleSidebar: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
  openModal: (name: string, data?: any) => void;
  closeModal: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleFullscreen: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  activeModal: null,
  modalData: null,
  theme: 'light',
  isFullscreen: false,

  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  openSidebar: () => set({ sidebarOpen: true }),

  openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  setTheme: (theme) => set({ theme }),
  toggleFullscreen: () => set(state => ({ isFullscreen: !state.isFullscreen })),
}))
