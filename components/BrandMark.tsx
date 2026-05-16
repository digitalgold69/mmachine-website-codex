import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  priority?: boolean;
};

export default function BrandMark({
  className = "h-11 w-11",
  priority = false,
}: BrandMarkProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <Image
        src="/brand/m-machine-butterfly.png"
        alt=""
        fill
        sizes="48px"
        priority={priority}
        className="object-contain drop-shadow-sm"
      />
    </span>
  );
}
