from rest_framework.response import Response
from rest_framework import exceptions
from rest_framework.views import APIView
from myapp.serializers import AccountSerializer, SongSerializer, LibrarySerializer
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from myapp.jwt import test_decode
from myapp.models import User, Library


# this will be ground (homepage)
# homepage, library, music streaming part
class HomeView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        # GET LIST of songs per user (library)
        user = request.user
        library = []
        tracklist = []
        songs = Library.objects.filter(username=user)
        for song_objects in songs:
            song_list = song_objects.song.all()
            for songs in song_list:
                library.append(songs)
                # ACUTAUL SONG OBJ FROM DJANGO
                for s in library:
                    tracklist.append(s.song)
                print(tracklist)

        # jwt to pass to library?
        jwt = request.headers.get('authorization').split(" ")[1]

        return Response({'home': 'shit otw holmes'})

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
    
# Login + homepage 
class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):   
        print(request.data)    
        try:
            username = request.data.get("username")
            password = request.data.get("password")
            user = authenticate(
                    username=username,
                    password=password
                )
            if not user:
                raise exceptions.APIException({'error': 'Invalid credentials'})
            if not user.is_active:
                raise exceptions.APIException({'error': 'User is inactive'})
            jwt = RefreshToken.for_user(user)
            # SHOULD POSSIBLY USE REFRESH TOKEN FOR LOGIN(S) 
            # ACCESS TOKEN FOR INITIAL ACC/RESOURCE 
            refresh_token = str(jwt) # signed tokens
            access_token = str(jwt.access_token) # signed tokens
            # after sign in api get user home page 
            header = {"Authorization": 'Bearer ' + access_token}
            requests.get('http://undergroundradio.us/ground/', headers=header)
            # IF JWT EXPIRE DO REFRESH CONDITION 
            print('login is successful')
            return Response({"Login": "True"})
        except:
          return Response({'error': "login credentials not valid"})


class SongView(APIView):
    def play(request):
     return Response('fuc4')
    def nft(request):
        return Response('fuc4')

class LibraryView(APIView):
    # Get user object since it's foreign key in library table
    User = get_user_model()
    def post(self, request):
        # check jwt & proceed if valid
        jwt = request.headers.get('authorization').split(" ")[1]
        if test_decode(jwt):
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
            # Gets user object using request username param
            username = data['username']
            user = User.objects.get(username=username)
            serializer = LibrarySerializer(data=data)
            if serializer.is_valid():
                # User object is foreign key to library table so we include
                serializer.save(username=user)
                return Response({"song(s)": "should have added to library"})
            else:
                print(serializer.errors)
                return Response({"error": 'something didnt parse right'})
        else:
            return Response({"error": 'jwt didnt parse u no have authorization'})


