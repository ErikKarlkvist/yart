import { type JSX } from 'react';
import { APP_NAME } from '@/common/model/brand';
import mark from './brand/yart-mark.svg';

interface Props {
  size?: 'md' | 'lg';
}

/** Märket och namnet. Namnet är text, så det får appens mono-typsnitt. */
export function BrandMark({ size = 'md' }: Props): JSX.Element {
  return (
    <span className={`brand-mark brand-mark--${size}`}>
      <img className="brand-mark__image" src={mark} alt="" />
      <span className="brand-mark__name">{APP_NAME}</span>
    </span>
  );
}
