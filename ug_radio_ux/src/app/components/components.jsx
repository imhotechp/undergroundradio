'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

function HomeIcon({ filled }) {
    if (filled) {
        return (
            <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 3.2 2.5 11h2.3v9a1 1 0 0 0 1 1H9v-7h6v7h3.2a1 1 0 0 0 1-1v-9h2.3L12 3.2z" />
            </svg>
        );
    }
    return (
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5.5 10v9a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1v-9" />
        </svg>
    );
}

function LibraryIcon({ filled }) {
    if (filled) {
        return (
            <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="3.5" y="4" width="17" height="4.2" rx="1.2" />
                <rect x="3.5" y="9.9" width="17" height="4.2" rx="1.2" />
                <rect x="3.5" y="15.8" width="10.5" height="4.2" rx="1.2" />
            </svg>
        );
    }
    return (
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3.5" y="4" width="17" height="4.2" rx="1.2" />
            <rect x="3.5" y="9.9" width="17" height="4.2" rx="1.2" />
            <rect x="3.5" y="15.8" width="10.5" height="4.2" rx="1.2" />
        </svg>
    );
}

function AccountIcon({ filled }) {
    if (filled) {
        return (
            <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="8" r="3.6" />
                <path d="M4.6 20.4c.6-4 3.5-6.8 7.4-6.8s6.8 2.8 7.4 6.8a1 1 0 0 1-1 1.1H5.6a1 1 0 0 1-1-1.1z" />
            </svg>
        );
    }
    return (
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20c0-3.6 3.1-6.4 7-6.4s7 2.8 7 6.4" />
        </svg>
    );
}

const TABS = [
    { href: '/library', label: 'Library', Icon: LibraryIcon },
    { href: '/home', label: 'Home', Icon: HomeIcon },
    { href: '/account', label: 'Account', Icon: AccountIcon },
];

export function NavBar(){
    const pathname = usePathname();
    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
            <ul className="flex w-full max-w-md items-center justify-between gap-1 rounded-full border border-white/10 bg-[var(--theme-nav-bg)] p-1.5 shadow-[0_10px_36px_-6px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                {TABS.map(({ href, label, Icon }) => {
                    const active = pathname === href;
                    return (
                        <li key={href} className="flex-1">
                            <Link
                                href={href}
                                className="relative flex flex-col items-center gap-0.5 rounded-full px-5 py-2 text-[10px] font-medium"
                                style={{ color: active ? "var(--theme-accent)" : "rgba(255,255,255,0.45)" }}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="nav-active-pill"
                                        className="absolute inset-0 rounded-full bg-white/10 shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
                                        transition={{ type: "spring", stiffness: 500, damping: 32 }}
                                    />
                                )}
                                <motion.span
                                    whileTap={{ scale: 0.85 }}
                                    className="relative z-10 flex items-center justify-center"
                                >
                                    <Icon filled={active} />
                                </motion.span>
                                <span className="relative z-10">{label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    )
}
