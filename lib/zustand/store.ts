import { create } from "zustand";

type Store = {
  isMenuOpen: boolean;
  setMenuOpen: (state: boolean) => void;
};

const useStore = create<Store>((set) => ({
  isMenuOpen: false,
  setMenuOpen: (state: boolean) => set({ isMenuOpen: state }),
}));

export default useStore;
