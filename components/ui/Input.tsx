// Reusable input component
import { cn } from '../../lib/utils/cn';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export default function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn('border rounded p-2 w-full', className)}
      {...props}
    />
  );
}