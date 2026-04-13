import { create } from 'zustand'

export const useUiStore = create((set) => ({
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
