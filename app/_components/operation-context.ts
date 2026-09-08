"use client";

import { createContext, useContext } from "react";

export type RequestOperation = (description: string, initialValue?: string, minimum?: number) => Promise<string | null>;

export const OperationContext = createContext<RequestOperation>(async () => null);

export function useOperationPrompt() {
  return useContext(OperationContext);
}
