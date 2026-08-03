"use client";

import Link from "next/link";
import type { Playlist } from "@/app/lib/api";
import { gradientForIndex } from "@/app/components/library-components/track-art";

function PlayAllGlyph() {
  return (
    <svg width="34%" height="34%" viewBox="0 0 24 24" fill="currentColor" className="text-white/70" aria-hidden>
      <path d="M6 4.5v15l14-7.5-14-7.5z" />
    </svg>
  );
}

function NoteGlyph() {
  return (
    <svg width="30%" height="30%" viewBox="0 0 24 24" fill="currentColor" className="text-white/25" aria-hidden>
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

function PlaylistTile({
  href,
  name,
  subtitle,
  index,
  glyph,
  coverArt,
}: {
  href: string;
  name: string;
  subtitle: string;
  index: number;
  glyph: "all" | "note";
  coverArt?: string;
}) {
  return (
    <Link href={href} className="flex flex-col gap-2 active:opacity-70">
      {coverArt ? (
        // eslint-disable-next-line @next/next/no-img-element -- external R2 URL, not in next/image's allowed domains
        <img
          src={coverArt}
          alt={name}
          className="aspect-square w-full overflow-hidden rounded-xl object-cover"
        />
      ) : (
        <div
          className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundImage: gradientForIndex(index) }}
        >
          {glyph === "all" ? <PlayAllGlyph /> : <NoteGlyph />}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--theme-fg)]">{name}</p>
        <p className="truncate text-xs text-white/40">{subtitle}</p>
      </div>
    </Link>
  );
}

/** "All Songs" is the aggregate across every playlist a user has — not a Library row itself. */
export function PlaylistGrid({ playlists }: { playlists: Playlist[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 px-4 pb-6 pt-4">
      <PlaylistTile
        href="/home"
        name="All Songs"
        subtitle="Everything in your library"
        index={-1}
        glyph="all"
      />
      {playlists.map((playlist, index) => (
        <PlaylistTile
          key={playlist.id}
          href={`/library/${playlist.id}`}
          name={playlist.name}
          subtitle={`${playlist.song_count} ${playlist.song_count === 1 ? "Song" : "Songs"}`}
          index={index}
          glyph="note"
          coverArt={playlist.coverArt}
        />
      ))}
    </div>
  );
}
