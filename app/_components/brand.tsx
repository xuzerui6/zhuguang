import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="zg-brand" href="/" aria-label="逐光首页">
      <Image alt="" height={34} priority src="/logo-mark.svg" unoptimized width={34} />
      <span>
        <strong>逐光</strong>
        {!compact ? <small>运动教练服务平台</small> : null}
      </span>
    </Link>
  );
}
