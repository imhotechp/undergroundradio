from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

class Song(models.Model):
    song = models.CharField()
    artist_name = models.CharField()
    email = models.CharField()
    producer = models.CharField(null=True, blank=True)
    lyrics = models.CharField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)
    coverArt = models.CharField(blank=True)
    url = models.CharField(blank=True)  # playable stream URL (R2 via the public Worker)
    plays = models.IntegerField(null=True, blank=True)
    nft_status = models.BooleanField(null=True, blank=True)
    media_type = models.CharField(
        max_length=10,
        choices=[('audio', 'audio'), ('video', 'video')],
        default='audio',
    )
    # Adaptive-bitrate master playlist URL for a video, set once its
    # VideoTranscodeJob finishes — blank (and irrelevant) for audio, and
    # blank-but-pending for a video whose transcode hasn't finished yet, in
    # which case the player falls back to the raw `url` directly.
    hls_url = models.CharField(blank=True)


class VideoTranscodeJob(models.Model):
    song = models.OneToOneField(Song, on_delete=models.CASCADE, related_name='transcode_job')
    status = models.CharField(
        max_length=10,
        choices=[
            ('pending', 'pending'),
            ('processing', 'processing'),
            ('done', 'done'),
            ('failed', 'failed'),
        ],
        default='pending',
    )
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
class User(AbstractUser):
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    # {bg, fg, navBg, accent} hex colors — empty dict means "no custom theme
    # saved yet", distinct from an explicit reset to defaults
    theme = models.JSONField(default=dict, blank=True)
    # The mp3juug.com ?token=... from this user's most recent signup/login
    # that carried one — LibraryView (/add/) requires this to match before
    # accepting a song, and clears it on success, so redeeming a song into a
    # library requires having actually gone through that token hand-off
    # (once) rather than any authenticated user being able to POST arbitrary
    # song data to their own library at will.
    pending_song_token = models.CharField(max_length=255, blank=True, null=True)

#. Multiple users can have multiple libraries (like playlists)
class Library(models.Model):
    username = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, to_field='username')
    name = models.CharField(default='Playlist001')
    song = models.ManyToManyField(Song)
    coverArt = models.CharField(blank=True)