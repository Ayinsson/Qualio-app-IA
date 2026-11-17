import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  /** Tarjeta clicable (abre un detalle). Agrega foco con teclado. */
  interactive?: boolean;
};

export function Card({ padded = true, interactive = false, className, ...rest }: CardProps) {
  const classes = [
    'q-card',
    padded ? 'q-card--pad' : '',
    interactive ? 'q-card--interactive' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes} tabIndex={interactive ? 0 : undefined} {...rest} />;
}
