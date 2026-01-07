"use client";

import { createContext, useContext } from "react";
import { Role } from "@/shared/types/permissions";

type UserContextValue = {
  role: Role;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  // mock role for now
  const value: UserContextValue = { role: "editor" };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
