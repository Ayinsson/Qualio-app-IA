import { getAvatarColor, getInitials } from './logic';

type AvatarProps = {
  /** Nombre o correo de la persona. */
  name: string;
  src?: string | null;
  size?: number;
};

export function Avatar({ name, src, size = 28 }: AvatarProps) {
  return (
    <span
      className="q-avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: src ? 'transparent' : getAvatarColor(name),
      }}
      title={name}
    >
      {src ? <img src={src} alt={name} /> : <span aria-label={name}>{getInitials(name)}</span>}
    </span>
  );
}
