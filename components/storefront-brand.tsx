import Link from "next/link";
import Image from "next/image";
import type { StorefrontTenant } from "@/lib/tenant-data";

type StorefrontBrandProps = {
  tenant: Pick<StorefrontTenant, "name" | "logo">;
};

export function StorefrontBrand({ tenant }: StorefrontBrandProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link href="/" aria-label={`Go to ${tenant.name} home page`} className="shrink-0">
        <span className="block aspect-[2.5] w-36 overflow-hidden rounded-xl bg-white">
          <Image
            src={tenant.logo.src}
            alt={tenant.logo.alt}
            width={1902}
            height={827}
            className="h-full w-full object-cover object-top"
          />
        </span>
      </Link>
    </div>
  );
}
