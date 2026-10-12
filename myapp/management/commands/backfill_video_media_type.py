"""
One-time fixup for Song rows delivered before video support existed: anything
whose url is actually a video file but is still flagged media_type='audio'
(the model's default) and has no VideoTranscodeJob, so it never got queued
for transcoding. Safe to re-run — every song it touches ends up in the same
state (media_type='video', a pending or reset job) whether this is the first
run or the fifth.
"""
from django.core.management.base import BaseCommand

from myapp.models import Song, VideoTranscodeJob
from myapp.views import _media_type_for_url


class Command(BaseCommand):
    help = "Flags any Song whose url is a video file as media_type='video' and queues a transcode job if it's missing one."

    def handle(self, *args, **options):
        fixed = 0
        queued = 0
        for song in Song.objects.all():
            if _media_type_for_url(song.url) != 'video':
                continue

            if song.media_type != 'video':
                song.media_type = 'video'
                song.save(update_fields=['media_type'])
                fixed += 1
                self.stdout.write(f"Song {song.pk} ({song.song!r}): flagged as video")

            if song.hls_url:
                continue  # already has an adaptive playlist, nothing to queue

            job, created = VideoTranscodeJob.objects.get_or_create(song=song)
            if created or job.status in ('done', 'failed'):
                job.status = 'pending'
                job.error = ''
                job.save(update_fields=['status', 'error'])
                queued += 1
                self.stdout.write(f"Song {song.pk} ({song.song!r}): queued for transcode")

        self.stdout.write(self.style.SUCCESS(f"Done — {fixed} song(s) reflagged, {queued} job(s) queued."))
