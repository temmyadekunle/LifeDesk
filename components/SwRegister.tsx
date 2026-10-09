"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "@/lib/serviceWorker";

export default function SwRegister() {
  useEffect(() => {
    return registerServiceWorker();
  }, []);

  return null;
}
