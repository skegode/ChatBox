import React, { useEffect, useRef, useState } from 'react';

type StableImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null;
  placeholder?: string;
};

export default function StableImage({ src, placeholder = '/images/default-avatar.png', alt, ...rest }: StableImageProps) {
  // Keep the last valid non-empty src so we don't clear the image when transient updates remove it.
  const lastSrcRef = useRef<string | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string>(placeholder);

  useEffect(() => {
    if (src && src !== lastSrcRef.current) {
      lastSrcRef.current = src;
      setDisplaySrc(src);
    }
    // If src becomes falsy, keep showing the lastSrcRef (avoid blanking)
  }, [src]);

  return (
    <img
      src={displaySrc}
      alt={alt}
      decoding="async"
      loading="lazy"
      {...rest}
    />
  );
}
