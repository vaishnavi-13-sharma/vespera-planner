import { useEffect } from 'react';
import { useVespera } from '../context/VesperaContext';
import { applyRealm } from '../lib/realm';

/** Keeps the page painted in the chosen Realm. */
export function RealmEffect() {
  const { state } = useVespera();
  const { realm } = state.settings;
  useEffect(() => applyRealm(realm), [realm]);
  return null;
}
