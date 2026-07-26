from rest_framework.response import Response
from rest_framework.views import APIView
from myapp.serializers import AccountSerializer, SongSerializer, LibrarySerializer
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from myapp.models import Library, Song


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

# create user + logins + add song(s) to library
class AccountView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # CREATE ACCOUNT
        token = request.query_params.get('token')
        serializer = AccountSerializer(data=request.data)
        username = request.data.get('username')
        if serializer.is_valid():
            user = serializer.save()
            # LOGIN
            user = authenticate(
            request=request,
            username=request.data.get('username'),
            password=request.data.get('password')
        )
            if not user:
                return Response(serializer.errors, status=400)
            if not user.is_active:
                return Response(serializer.errors, status=400)
            jwt = RefreshToken.for_user(user)
            refresh_token = str(jwt) # signed tokens
            access_token = str(jwt.access_token) # signed tokens
            # GET METADATA SENT TO /ADD endpoint retreive and return resource here
            payload = {'token': token, 'username': username, 'email': request.data.get('email')}
            headers= {"Authorization": "Bearer " + access_token}
            r = requests.get('https://mp3juug.com/musicv2', headers=headers, params=payload)
            return Response({"success": "songs should be adding", "status":r.status_code})
        return Response(serializer.errors, status=400)
    
# Login
class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)
        if not user:
            return Response({'error': 'Invalid credentials'}, status=401)
        if not user.is_active:
            return Response({'error': 'User is inactive'}, status=401)
        jwt = RefreshToken.for_user(user)
        refresh_token = str(jwt)
        access_token = str(jwt.access_token)
        return Response({"access": access_token, "refresh": refresh_token})


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
        results = []
        # Save each song individually since request song param is []
        for song_value in songs:
            # copy reuqest.data since immutable & set one value at a time
            data = request.data.copy()
            data['song'] = song_value

            song_serializer = SongSerializer(data=data)
            if song_serializer.is_valid():
                # save song(s) to song table
                obj = song_serializer.save()
                # Since song objects are saved to library we save pks
                results.append(obj.pk)
            else:
                print('errors:', song_serializer.errors, flush=True)
                return Response(song_serializer.errors, status=400)
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


