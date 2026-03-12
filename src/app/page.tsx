"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      // Recovery/invite link — redirect to set-password with hash intact
      window.location.href = "/set-password" + hash;
    } else {
      window.location.href = "/login";
    }
  }, []);

  return null;
}
