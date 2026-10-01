export default function VerifiedBadge() {
  return (
    <span
      title="Verified account"
      aria-label="Verified account"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 13,
        height: 13,
        marginLeft: 3,
        marginRight: 3,
        borderRadius: "50%",
        background: "#6D28D9",
        color: "#fff",
        fontSize: 8,
        fontWeight: 800,
        lineHeight: 1,
        verticalAlign: "middle",
        flex: "0 0 auto",
      }}
    >
      ✓
    </span>
  );
}
