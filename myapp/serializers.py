# serializers.py
from rest_framework import serializers
from myapp.models import User, Song, Library
import re
from django.contrib.auth import authenticate
# MUST INCLUDE EVERY FIELD HERE IN EVERY REQUEST
class AccountSerializer(serializers.ModelSerializer):
    username = serializers.CharField(min_length=3, max_length=20)
    password = serializers.CharField(
        min_length=8,
        write_only=True
    )
    email = serializers.EmailField()
    phone_number = serializers.CharField()
    date_created = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = (
            'username',
            'password',
            'email',
            'phone_number',
            'date_created',
        )

    #. validates input
    def validate(self, data):
        data['username'] = data['username'].strip().lower()
        data['password'] = data['password'].strip()
        data['email'] = data['email'].strip().lower()
        data['phone_number'] = data['phone_number'].strip()
        #. check if username length is greater than 20 or less than 3
        if len(data['username']) < 3 or len(data['username']) > 20:
            raise serializers.ValidationError('Username must be between 3 characters long')
        if not re.match(r"^\w+$", data['username']):
            raise serializers.ValidationError(
                'Invalid characters used in username. ' \
                'Only letters, numbers, and underscores ' \
                'are allowed')
        #. check if password at least 8 characters + a certain format
        if len(data['password']) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters long')
        if not re.match(r"^[a-zA-Z0-9_!@#$]+$", data['password']):
            raise serializers.ValidationError(
                'Invalid characters used in password. ' \
                'Only letters, numbers, and these ' \
                'special characters "_!@#$" are allowed')
        #. check if email is certain format
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+$", data['email']):
            raise serializers.ValidationError('Invalid characters used in email.')
        #. check if phone number certain format 
        if not re.match(r"^\d{10,10}$", data['phone_number']):
            raise serializers.ValidationError('Invalid US phone number.')
        return data
    # create user 
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user
    
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=20)
    password = serializers.CharField(
        min_length=8,
        write_only=True
    )

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