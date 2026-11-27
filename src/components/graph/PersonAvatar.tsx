/**
 * Round avatar for a person: their photo, or initials on a pastel gradient
 * picked from their gender (sky, rose, or sunflower when unknown).
 */
export function avatarColors(gender?: string): string {
  switch (gender) {
    case 'male':
      return 'bg-gradient-to-br from-sky-300 to-sky-500 ring-sky-100';
    case 'female':
      return 'bg-gradient-to-br from-rose-300 to-rose-500 ring-rose-100';
    default:
      return 'bg-gradient-to-br from-sun-300 to-sun-500 ring-sun-100';
  }
}

export function initialsOf(firstName: string, lastName?: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName?.trim().charAt(0).toUpperCase() ?? '';
  return first + last || '?';
}

const SIZES = {
  sm: 'h-10 w-10 text-xs ring-2',
  md: 'h-12 w-12 text-sm ring-4',
  lg: 'h-20 w-20 text-2xl ring-4',
} as const;

export default function PersonAvatar({
  firstName,
  lastName,
  gender,
  photoUrl,
  size = 'md',
}: {
  firstName: string;
  lastName?: string;
  gender?: string;
  photoUrl?: string;
  size?: keyof typeof SIZES;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName}'s photo`}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-white shadow-sm`}
      />
    );
  }
  return (
    <div
      className={`${SIZES[size]} ${avatarColors(gender)} flex shrink-0 items-center justify-center rounded-full font-extrabold text-white shadow-sm`}
      aria-hidden="true"
    >
      {initialsOf(firstName, lastName)}
    </div>
  );
}
