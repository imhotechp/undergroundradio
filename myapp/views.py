from rest_framework.response import Response
from rest_framework.views import APIView
from myapp.serializers import AccountSerializer, SongSerializer, LibrarySerializer
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView
from django.utils.dateparse import parse_duration
import requests
from myapp.models import Library, Song


def notify_mp3juug(token, username, email, access_token):
    """Tells mp3juug.com a signup/login just completed so it can deliver the song
    the token references to this user's account. Best-effort: a slow or unreachable
    mp3juug.com must never block or break the caller's own signup/login response."""
    try:
        response = requests.get(
            'https://mp3juug.com/musicv2',
            headers={"Authorization": "Bearer " + access_token},
            params={'token': token, 'username': username, 'email': email},
            timeout=5,
        )
        print(
            'notify_mp3juug: token=%r username=%r status=%s body=%r'
            % (token, username, response.status_code, response.text[:500]),
            flush=True,
        )
    except requests.RequestException as e:
        print('notify_mp3juug failed:', e, flush=True)


# this will be ground (homepage)
# homepage, library, music streaming part
class HomeView(APIView):
    # Default IsAuthenticated (see REST_FRAMEWORK settings) — request.user must be
    # a real authenticated user for the Library filter below to mean anything.
    def get(self, request):
        libraries = Library.objects.filter(username=request.user)
        songs = Song.objects.filter(library__in=libraries).distinct()
        serializer = SongSerializer(songs, many=True)
        return Response(serializer.data)


# A user's playlists — each Library row is one playlist. "All Songs" (HomeView
# above) isn't one of these; it's the aggregate across every playlist a user has.
class PlaylistsView(APIView):
    def get(self, request):
        libraries = Library.objects.filter(username=request.user)
        data = [
            {
                "id": library.pk,
                "name": library.name,
                "coverArt": library.coverArt,
                "song_count": library.song.count(),
            }
            for library in libraries
        ]
        return Response(data)


class PlaylistDetailView(APIView):
    def get(self, request, pk):
        library = get_object_or_404(Library, pk=pk, username=request.user)
        serializer = SongSerializer(library.song.all(), many=True)
        return Response({"id": library.pk, "name": library.name, "songs": serializer.data})


class MeView(APIView):
    def get(self, request):
        user = request.user
        return Response({
            "username": user.username,
            "email": user.email,
            "phone_number": user.phone_number,
        })

# Create an account. This is the entry point for links like
# /musicv2?token=... from mp3juug.com — the token references a song that
# should be delivered to whoever completes signup through that link.
class AccountView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.query_params.get('token')
        serializer = AccountSerializer(data=request.data)
        if not serializer.is_valid():
            message = next(iter(serializer.errors.values()))[0]
            return Response({'error': str(message)}, status=400)

        try:
            user = serializer.save()
        except IntegrityError:
            return Response({'error': 'That username is already taken.'}, status=400)
        jwt = RefreshToken.for_user(user)
        refresh_token = str(jwt)
        access_token = str(jwt.access_token)

        if token:
            notify_mp3juug(token, user.username, user.email, access_token)

        return Response({"access": access_token, "refresh": refresh_token})
    
# Login. Also doubles as the /musicv2?token=... entry point for a returning
# user — same as AccountView, if a token is present the song it references
# gets attached via the mp3juug.com notification below.
class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        token = request.query_params.get('token')
        user = authenticate(username=username, password=password)
        if not user:
            return Response({'error': 'Invalid credentials'}, status=401)
        if not user.is_active:
            return Response({'error': 'User is inactive'}, status=401)
        jwt = RefreshToken.for_user(user)
        refresh_token = str(jwt)
        access_token = str(jwt.access_token)

        if token:
            notify_mp3juug(token, user.username, user.email, access_token)

        return Response({"access": access_token, "refresh": refresh_token})


# Default DRF permission is IsAuthenticated, which needs a valid access
# token — exactly what a client refreshing an *expired* access token
# doesn't have. AllowAny here; the refresh token itself (in the body) is
# what actually gets validated by the base view.
class TokenRefreshView(BaseTokenRefreshView):
    permission_classes = [AllowAny]


class SongView(APIView):
    """Client (Next.js / frontend)
        ↓
        Cloudflare Worker (TS/JS)
        ↓
        R2 (streaming storage)

        Django (separate backend)
        ↓
        Postgres + auth + business logic"""
    # Default IsAuthenticated (see REST_FRAMEWORK settings). Not implemented yet —
    # previously returned None here, which 500'd for any authenticated caller.
    def get(self, request):
        return Response({"detail": "Not implemented yet."}, status=501)


class LibraryView(APIView):
    # Default IsAuthenticated (see REST_FRAMEWORK settings) — JWTAuthentication
    # already verified the token and set request.user before this runs, so the
    # library being modified is always the caller's own, never a client-supplied one.
    def post(self, request):
        songs = request.data.get('song')
        urls = request.data.get('url') or []
        durations = request.data.get('duration') or []
        results = []
        # Save each song individually since request song param is []
        for i, song_value in enumerate(songs):
            # copy reuqest.data since immutable & set one value at a time
            data = request.data.copy()
            data['song'] = song_value
            data['url'] = urls[i] if i < len(urls) else ''
            # parse_duration('') parses as a real 0:00:00, not an error — omit
            # the key entirely when there's no value instead of storing a fake
            # zero duration for a song whose length just wasn't captured
            duration_value = durations[i] if i < len(durations) else ''
            if duration_value:
                data['duration'] = duration_value
            else:
                data.pop('duration', None)
            print('DEBUG duration_value:', repr(duration_value), 'data duration:', repr(data.get('duration')), flush=True)

            # reuse an existing identical Song instead of creating a duplicate
            # row — e.g. a link opened twice, or the same song forwarded via
            # two different links, shouldn't fork into two Song records
            existing_song = Song.objects.filter(
                song=song_value,
                artist_name=data.get('artist_name'),
                email=data.get('email'),
            ).first()
            if existing_song:
                obj_pk = existing_song.pk
                print('DEBUG existing_song path, pk:', obj_pk, 'existing duration:', repr(existing_song.duration), flush=True)
                # backfill fields that were blank on the existing row (e.g. it
                # was created before `url`/`duration` existed) with fresher
                # incoming data
                update_fields = []
                if not existing_song.url and data.get('url'):
                    existing_song.url = data['url']
                    update_fields.append('url')
                if not existing_song.coverArt and data.get('coverArt'):
                    existing_song.coverArt = data['coverArt']
                    update_fields.append('coverArt')
                if not existing_song.duration and data.get('duration'):
                    parsed = parse_duration(str(data['duration']))
                    print('DEBUG backfill parse_duration:', repr(data['duration']), '->', repr(parsed), flush=True)
                    if parsed is not None:
                        existing_song.duration = parsed
                        update_fields.append('duration')
                print('DEBUG update_fields:', update_fields, flush=True)
                if update_fields:
                    existing_song.save(update_fields=update_fields)
            else:
                print('DEBUG create path, incoming duration:', repr(data.get('duration')), flush=True)
                song_serializer = SongSerializer(data=data)
                if song_serializer.is_valid():
                    # save song(s) to song table
                    obj = song_serializer.save()
                    obj_pk = obj.pk
                    print('DEBUG created song pk:', obj_pk, 'saved duration:', repr(obj.duration), flush=True)
                else:
                    print('errors:', song_serializer.errors, flush=True)
                    return Response(song_serializer.errors, status=400)

            # skip songs this user already has anywhere in their library —
            # re-redeeming the same link shouldn't duplicate the entry
            if Library.objects.filter(username=request.user, song__pk=obj_pk).exists():
                continue
            results.append(obj_pk)

        if not results:
            return Response({"song(s)": "already in library"})

        # same thing for library..
        data = request.data.copy()
        data['song'] = results
        serializer = LibrarySerializer(data=data)
        if serializer.is_valid():
            # User object is foreign key to library table so we include
            serializer.save(username=request.user)
            return Response({"song(s)": "should have added to library"})
        else:
            print(serializer.errors)
            return Response({"error": 'something didnt parse right'}, status=400)


