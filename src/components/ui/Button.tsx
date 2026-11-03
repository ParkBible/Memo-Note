import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** 아이콘만 있는 버튼. 접근성을 위해 aria-label 을 꼭 넘긴다 */
  iconOnly?: boolean;
  block?: boolean;
}

function buttonClass({ variant = 'primary', size = 'md', iconOnly, block }: StyleProps, extra?: string) {
  return cx(styles.button, styles[variant], styles[size], iconOnly && styles.iconOnly, block && styles.block, extra);
}

function Content({ icon, size = 'md', loading, children }: { icon?: IconName; size?: ButtonSize; loading?: boolean; children?: ReactNode }) {
  const iconSize = size === 'lg' ? 20 : size === 'sm' ? 16 : 18;
  return (
    <>
      {loading ? <span className={styles.spinner} aria-hidden /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
    </>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  loading?: boolean;
}

export function Button({ variant, size, icon, iconOnly, block, loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, iconOnly, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon} size={size} loading={loading}>
        {children}
      </Content>
    </button>
  );
}

export interface ButtonLinkProps extends LinkProps, StyleProps {}

/** 라우터 이동용 버튼 모양 링크 */
export function ButtonLink({ variant, size, icon, iconOnly, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, iconOnly, block }, className)} {...rest}>
      <Content icon={icon} size={size}>
        {children}
      </Content>
    </Link>
  );
}

/** 외부 링크(새 탭)용 버튼 모양 a 태그 */
export function ButtonAnchor({
  variant,
  size,
  icon,
  iconOnly,
  block,
  className,
  children,
  ...rest
}: StyleProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={buttonClass({ variant, size, iconOnly, block }, className)} target="_blank" rel="noreferrer noopener" {...rest}>
      <Content icon={icon} size={size}>
        {children}
      </Content>
    </a>
  );
}
