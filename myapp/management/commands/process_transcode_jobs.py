"""
Transcodes the oldest pending video into adaptive-bitrate HLS and uploads it
to R2. Processes at most one job per invocation — this is meant to be fired
periodically by a systemd timer (undergroundradio-transcode.timer), not run
as a long-lived loop, so a single pass never competes with itself for the
VPS's 2 cores, which also run the live API.
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

import boto3
import requests
import sentry_sdk
from django.conf import settings
from django.core.management.base import BaseCommand

from myapp.models import VideoTranscodeJob

# (bitrate_kbps, height) — width is derived per-source to preserve aspect
# ratio. Renditions taller than the source are skipped; nothing to gain from
# upscaling, and it wastes the CPU time this VPS also needs for live traffic.
RENDITIONS = [
    (5000, 1080),
    (2800, 720),
    (1400, 480),
]
SEGMENT_SECONDS = 6
FFMPEG_TIMEOUT_S = 1800  # bounds a single stuck job so it can't stall the queue forever


class Command(BaseCommand):
    help = "Transcodes the oldest pending VideoTranscodeJob into HLS and uploads it to R2."

    def handle(self, *args, **options):
        job = (
            VideoTranscodeJob.objects.select_related("song")
            .filter(status="pending")
            .order_by("created_at")
            .first()
        )
        if not job:
            return

        # Conditional update as a claim — cheap insurance against two timer
        # ticks somehow overlapping on the same job; a single-process timer
        # shouldn't race itself, but this makes it impossible rather than unlikely.
        claimed = VideoTranscodeJob.objects.filter(pk=job.pk, status="pending").update(status="processing")
        if not claimed:
            return

        song = job.song
        self.stdout.write(f"Transcoding song {song.pk} ({song.song!r}) from {song.url}")

        workdir = Path(tempfile.mkdtemp(prefix=f"transcode-{song.pk}-"))
        try:
            source_path = workdir / "source"
            self._download(song.url, source_path)
            src_width, src_height = self._probe_resolution(source_path)
            renditions = [r for r in RENDITIONS if r[1] <= src_height] or [RENDITIONS[-1]]
            master_url = self._transcode_and_upload(song, source_path, src_width, src_height, renditions, workdir)

            song.hls_url = master_url
            song.save(update_fields=["hls_url"])
            job.status = "done"
            job.error = ""
            job.save(update_fields=["status", "error", "updated_at"])
            self.stdout.write(self.style.SUCCESS(f"Song {song.pk} ready: {master_url}"))
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            detail = str(exc)
            stderr = getattr(exc, "stderr", None)
            if stderr:
                detail += "\n" + (stderr.decode("utf-8", "replace") if isinstance(stderr, bytes) else str(stderr))
            job.status = "failed"
            job.error = detail[:4000]
            job.save(update_fields=["status", "error", "updated_at"])
            self.stderr.write(self.style.ERROR(f"Song {song.pk} failed: {detail}"))
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def _download(self, url, dest):
        with requests.get(url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=1024 * 1024):
                    f.write(chunk)

    def _probe_resolution(self, source_path):
        out = subprocess.run(
            [
                "ffprobe", "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height", "-of", "csv=p=0", str(source_path),
            ],
            capture_output=True, text=True, check=True, timeout=30,
        ).stdout.strip()
        width, height = (int(x) for x in out.split(","))
        return width, height

    def _transcode_and_upload(self, song, source_path, src_width, src_height, renditions, workdir):
        out_dir = workdir / "hls"
        out_dir.mkdir()

        cmd = ["ffmpeg", "-y", "-i", str(source_path)]
        for _ in renditions:
            cmd += ["-map", "0:v", "-map", "0:a"]
        var_maps = []
        for i, (bitrate, height) in enumerate(renditions):
            # even width required for yuv420p chroma subsampling
            width = round(src_width * height / src_height / 2) * 2
            cmd += [
                f"-c:v:{i}", "libx264", f"-b:v:{i}", f"{bitrate}k", f"-s:v:{i}", f"{width}x{height}",
                "-preset", "veryfast",
                f"-c:a:{i}", "aac", f"-b:a:{i}", "128k",
            ]
            var_maps.append(f"v:{i},a:{i}")
            (out_dir / f"stream_{i}").mkdir()
        cmd += [
            "-f", "hls", "-hls_time", str(SEGMENT_SECONDS), "-hls_playlist_type", "vod",
            "-master_pl_name", "master.m3u8",
            "-var_stream_map", " ".join(var_maps),
            "-hls_segment_filename", str(out_dir / "stream_%v" / "seg_%03d.ts"),
            str(out_dir / "stream_%v" / "playlist.m3u8"),
        ]

        # nice: never let a transcode compete for CPU with the live gunicorn
        # workers on this same 2-core box
        subprocess.run(["nice", "-n", "19"] + cmd, check=True, capture_output=True, timeout=FFMPEG_TIMEOUT_S)

        key_prefix = f"hls/{song.pk}"
        s3 = boto3.client(
            "s3", region_name="us-east-1", endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        )
        content_types = {".m3u8": "application/vnd.apple.mpegurl", ".ts": "video/mp2t"}
        for path in out_dir.rglob("*"):
            if path.is_file():
                key = f"{key_prefix}/{path.relative_to(out_dir).as_posix()}"
                s3.upload_file(
                    str(path), settings.R2_BUCKET, key,
                    ExtraArgs={"ContentType": content_types.get(path.suffix, "application/octet-stream")},
                )

        return f"{settings.R2_PUBLIC_BASE_URL}/{key_prefix}/master.m3u8"
