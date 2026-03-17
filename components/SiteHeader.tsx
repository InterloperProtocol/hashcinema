import Link from "next/link";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12 3.2 2.5 11h2.2v8.8h6.1v-5.6h2.4v5.6h6.1V11h2.2L12 3.2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M18.244 2H21.5l-7.11 8.128L22.75 22h-6.546l-5.126-6.708L5.21 22H1.95l7.606-8.694L1.5 2h6.712l4.633 6.12L18.244 2Zm-1.14 18.05h1.804L7.228 3.845H5.292L17.104 20.05Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M21.408 4.593a1.64 1.64 0 0 0-1.692-.208L3.127 11.23a1.19 1.19 0 0 0 .08 2.225l4.21 1.38 1.63 5.102a1.19 1.19 0 0 0 2.046.39l2.35-2.642 4.61 3.396a1.64 1.64 0 0 0 2.575-.95l2.215-13.913a1.64 1.64 0 0 0-.435-1.625ZM9.9 14.195l8.22-6.81-6.84 7.62a.6.6 0 0 0-.147.292l-.708 2.995-.525-3.033Z" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="relative z-40 px-4 pt-5 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-[1.6rem] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="cinema-secondary-button inline-flex items-center justify-center rounded-full p-2 text-sm font-medium transition"
          aria-label="Home"
        >
          <HomeIcon />
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="https://x.com/TrenchCinema"
            target="_blank"
            rel="noreferrer"
            className="cinema-secondary-button inline-flex items-center justify-center rounded-full p-2 text-sm font-medium transition"
            aria-label="Trench Cinema on X"
          >
            <XIcon />
          </a>
          <a
            href="https://t.me/hashartfun"
            target="_blank"
            rel="noreferrer"
            className="cinema-secondary-button inline-flex items-center justify-center rounded-full p-2 text-sm font-medium transition"
            aria-label="HashArt Telegram"
          >
            <TelegramIcon />
          </a>
        </div>
      </div>
    </header>
  );
}
