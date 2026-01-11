from django.db import models

class Song(models.Model):
    song_name = models.CharField()
    artist_name = models.CharField()
    producer_name = models.CharField()
    lyrics = models.CharField()
    duration = models.IntegerField()
    cover_art = models.CharField()
    plays = models.IntegerField()
    nft_status = models.CharField()
class User(models.Model):
    username = models.CharField()
    password = models.CharField()
    email = models.CharField()
    phone_number = models.IntegerField()
    date_created = models.DateField()
#. Multiple users can have multiple libraries (like playlists)
class Library(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    song = models.ManyToManyField(Song)