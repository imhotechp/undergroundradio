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
class User(AbstractUser):
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    # {bg, fg, navBg, accent} hex colors — empty dict means "no custom theme
    # saved yet", distinct from an explicit reset to defaults
    theme = models.JSONField(default=dict, blank=True)

#. Multiple users can have multiple libraries (like playlists)
class Library(models.Model):
    username = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, to_field='username')
    name = models.CharField(default='Playlist001')
    song = models.ManyToManyField(Song)
    coverArt = models.CharField(blank=True)