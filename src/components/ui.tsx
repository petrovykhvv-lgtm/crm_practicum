import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  breadcrumb?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {breadcrumb && (
          <div className="breadcrumb">
            <Link href={breadcrumb.href}>← {breadcrumb.label}</Link>
          </div>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="badge" style={{ ["--c" as string]: color }}>
      {children}
    </span>
  );
}

export function Card({ title, aside, children, className }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `glass ${className}` : "glass"}>
      {title && (
        <h2 className="card-title">
          {title}
          {aside && <small>{aside}</small>}
        </h2>
      )}
      {children}
    </section>
  );
}

export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="dl">
      {items.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkButton({ href, children, ghost }: { href: string; children: ReactNode; ghost?: boolean }) {
  return (
    <Link href={href} className={`btn ${ghost ? "btn-ghost" : "btn-primary"}`}>
      {children}
    </Link>
  );
}
