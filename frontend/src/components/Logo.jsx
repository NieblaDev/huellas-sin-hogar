export default function Logo({ size = 24, color = '#3f6c52' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Huellas Sin Hogar"
    >
      {/* Techo del refugio */}
      <path d="M3 10.5L12 3l9 7.5" />
      {/* Huella central */}
      <circle cx="9" cy="13.5" r="1.2" fill={color} stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill={color} stroke="none" />
      <circle cx="15" cy="13.5" r="1.2" fill={color} stroke="none" />
      <path d="M12 15.5c-2 0-3.5 1.5-3.5 3 0 1 1 1.5 2 1.5h3c1 0 2-.5 2-1.5 0-1.5-1.5-3-3.5-3z" fill={color} stroke="none" />
    </svg>
  );
}
