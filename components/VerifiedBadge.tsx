import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge() {
  return (
    <span
      title="Verified account"
      aria-label="Verified account"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        marginLeft: 4,
        color: "#6D28D9",
      }}
    >
      <BadgeCheck size={17} strokeWidth={2.7} aria-hidden="true" />
    </span>
  );
}
