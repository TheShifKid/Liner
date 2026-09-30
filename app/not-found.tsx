import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <div className="num text-7xl font-bold">404</div>
      <p className="mt-3 text-text-2">Nothing pressed at this address.</p>
      <Link href="/" className="label mt-6 inline-block underline">
        back to the shelf
      </Link>
    </div>
  );
}
