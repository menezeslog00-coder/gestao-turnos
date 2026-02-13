
import { RegistryData, INITIAL_REGISTRY } from "../types";

const STORAGE_KEY = 'lider_pro_registries';

export const getRegistries = (): RegistryData => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return INITIAL_REGISTRY;
  try {
    return JSON.parse(saved);
  } catch {
    return INITIAL_REGISTRY;
  }
};

export const saveRegistries = (data: RegistryData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
