import Link from "next/link";
import Image from "next/image";
import type { StorefrontTenant } from "@/lib/tenant-data";

type StorefrontBrandProps = {
  tenant: Pick<StorefrontTenant, "name" | "logo" | "address" | "phone">;
  tone?: "light" | "dark";
  detailsClassName?: string;
};

export function StorefrontBrand({
  tenant,
  tone = "light",
  detailsClassName = "",
}: StorefrontBrandProps) {
  const detailColor = tone === "dark" ? "text-slate-300" : "text-slate-600";

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
      <div className={`${detailsClassName} min-w-0 text-xs leading-5 ${detailColor}`}>
        <p>{tenant.address}</p>
        <p>{tenant.phone}</p>
      </div>
    </div>
  );
}
