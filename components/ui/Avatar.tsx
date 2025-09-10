// Reusable avatar component
import Image from 'next/image';

interface Props {
  src: string;
  alt: string;
}

export default function Avatar({ src, alt }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={25}
      height={25}
      className="rounded-full"
    />
  );
}