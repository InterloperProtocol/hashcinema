import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-nav">
        <div className="site-nav-copy">
          <p className="eyebrow">HashCinema</p>
          <div className="site-nav-taglines">
            <p className="site-nav-tagline">Multichain memecoin video generator</p>
            <p className="site-nav-summary">
              One token address in, one cinematic trading card out, with the same flow
              available as a UI shell or an x402-ready service.
            </p>
          </div>
        </div>

        <nav className="nav-links">
          <Link className="nav-link" href="/">
            Home
          </Link>
          <Link className="nav-link" href="/gallery">
            Gallery
          </Link>
          <Link className="nav-link" href="/api/service">
            Manifest
          </Link>
          <Link className="nav-link" href="/api/service">
            API
          </Link>
        </nav>
      </div>
    </header>
  );
}
