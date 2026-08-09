# serializers.py
from rest_framework import serializers
from myapp.models import User, Song, Library
import re
from django.contrib.auth import get_user_model
User = get_user_model()
# MUST INCLUDE EVERY FIELD HERE IN EVERY REQUEST
class AccountSerializer(serializers.ModelSerializer):
    username = serializers.CharField(min_length=3, max_length=20)
    password = serializers.CharField(
        min_length=8,
        write_only=True
    )
    email = serializers.EmailField()
    phone_number = serializers.CharField()

    class Meta:
        model = User
        fields = (
            'username',
            'password',
            'email',
            'phone_number',
        )

    #. validates input, attaching each failure to its own field (not a single
    #. generic non-field error) so the caller can tell the user exactly which
    #. box is wrong instead of them guessing, and collects every failing
    #. field at once instead of stopping at the first one found.
    def validate(self, data):
        data['username'] = data['username'].strip().lower()
        data['password'] = data['password'].strip()
        data['email'] = data['email'].strip().lower()
        data['phone_number'] = data['phone_number'].strip()

        errors = {}

        if len(data['username']) < 3 or len(data['username']) > 20:
            errors['username'] = 'Username must be between 3 and 20 characters.'
        elif not re.match(r"^\w+$", data['username']):
            errors['username'] = (
                'Only letters, numbers, and underscores are allowed in username.'
            )

        if len(data['password']) < 8:
            errors['password'] = 'Password must be at least 8 characters long.'
        elif not re.match(r"^[a-zA-Z0-9_!@#$]+$", data['password']):
            errors['password'] = (
                'Only letters, numbers, and these special characters "_!@#$" '
                'are allowed in password.'
            )

        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+$", data['email']):
            errors['email'] = 'Enter a valid email address.'

        if not re.match(r"^\d{10}$", data['phone_number']):
            errors['phone_number'] = 'Enter a valid 10-digit US phone number.'

        if errors:
            raise serializers.ValidationError(errors)

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
    song = serializers.CharField(required=True, min_length=1)
    artist_name = serializers.CharField(required=True, min_length=1)
    email = serializers.CharField(required=True)
    producer = serializers.CharField(required=False)
    lyrics = serializers.CharField(required=False)
    duration = serializers.DurationField(required=False)
    coverArt = serializers.CharField(required=False, allow_blank=True, default='')
    url = serializers.CharField(required=False, allow_blank=True, default='')
    plays = serializers.IntegerField(required=False)
    nft_status = serializers.BooleanField(default=False)

    class Meta:
        model = Song
        fields = (
            'song',
            'artist_name',
            'email',
            'coverArt',
            'url',
            'producer',
            'lyrics',
            'duration',
            'plays',
            'nft_status'
            )

        
class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = '__all__'
        # LibraryView always sets this from request.user (never trusts
        # client input, for auth reasons) — but as a required field it was
        # rejecting every request that didn't also supply it, which is every
        # request, since callers have no reason to send it. Making it
        # optional here just stops that pointless validation failure; the
        # view's override is what actually determines the value.
        extra_kwargs = {
            'username': {'required': False},
        }