import { useApp } from "../state/store";

export function ResetButton() {
  const activeFace = useApp((s) => s.activeFace);
  const closeDrawer = useApp((s) => s.closeDrawer);

  if (!activeFace) return null;

  return (
    <button
      className="reset-button"
      onClick={closeDrawer}
      title="Reset view"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
      <span>Reset View</span>
    </button>
  );
}
