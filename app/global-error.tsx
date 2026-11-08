"use client";

import { useEffect } from "react";

/** Last-resort boundary for errors in the root layout. Keep it dependency-free: no providers are available here. */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="uk">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "1rem",
        }}
      >
        <div role="alert" style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem" }}>Щось пішло не так / Something went wrong</h1>
          <p>Спробуйте ще раз за мить. / Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            Спробувати знову / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
