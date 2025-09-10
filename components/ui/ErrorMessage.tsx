// Displays error messages
interface Props {
  message: string;
}

export default function ErrorMessage({ message }: Props) {
  return (
    <div className="alert alert-danger my-2" role="alert">
      {message}
    </div>
  );
}