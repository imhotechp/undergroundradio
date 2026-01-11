from django.contrib.auth.models import AbstractUser
from django.db import models

class Song(models.Model):
    song_name = models.CharField()
    artist_name = models.CharField()
    producer_name = models.CharField()
    lyrics = models.CharField()
    duration = models.DurationField()
    cover_art = models.CharField()
    plays = models.IntegerField()
    nft_status = models.BooleanField()
class User(AbstractUser):
    phone_number = models.CharField(max_length=20, blank=True, null=True)

#. Multiple users can have multiple libraries (like playlists)
class Library(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    song = models.ManyToManyField(Song)