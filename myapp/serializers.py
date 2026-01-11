# serializers.py
from rest_framework import serializers
from myapp.models import User, Song, Library
from datetime import datetime
from myapp.mp3juugdb import find

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        username = serializers.CharField(required=True, min_length=1, max_length=20)
        password = serializers.CharField(required=True, min_length=1, max_length=20)
        email = serializers.EmailField(required=True)
        phone_number = serializers.IntegerField()
        date_created = serializers.DateTimeField(default=datetime.now())
    #. need to get the token from mp3juug and compare it to firstly mongoDB /music/juug2radio/
    def juug_to_ug(request, validated_data):
        
        token = request.query_params['token']
        if token:
            try:
                search = find(token)
                if search:
                    pass

            except:
                pass

    def create(self, validated_data):
        pass



class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        song_name = serializers.CharField(required=True, min_length=1)
        artist_name = serializers.CharField(required=True, min_length=1)
        producer_name = serializers.CharField(min_length=1)
        lyrics = serializers.CharField(min_length=1)
        duration = serializers.DurationField(required=True)
        cover_art = serializers.CharField(required=True, min_length=1)
        plays = serializers.IntegerField(default=0)
        nft_status = serializers.BooleanField(default=False)

class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = '__all__'