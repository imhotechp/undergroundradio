from rest_framework.response import Response
from rest_framework import exceptions
from rest_framework.views import APIView
from myapp.serializers import AccountSerializer, LoginSerializer, SongSerializer, LibrarySerializer
from .models import Library, Song
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import requests
import asyncio
from myapp.db import main
from myapp.jwt import test_decode
from myapp.models import User

# this will be ground (homepage)
class HomeView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        return Response({'home': 'shit otw holmes'})
# Creates user account
# create user + add song to library
# https://undergroundradio.us/music?token=xxxx
# create RSA Key pair (private and public)
# give public key to MP3JUUG
# sign jwts with private key

class AccountView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # CREATE ACCOUNT
        token = request.query_params.get('token')
        serializer = AccountSerializer(data=request.data)
        username = request.data.get('username')
        if serializer.is_valid():
            user = serializer.save()
            user = authenticate(
            request=request,
            username=request.data.get('username'),
            password=request.data.get('password')
        )
            if not user:
                return Response(serializer.errors, status=400)
            if not user.is_active:
                return Response(serializer.errors, status=400)
            # Get username id for pk
            #id = User.objects.filter(username=username).values_list('id', flat=True).first()
            # username_id = int(id)
            # create token for logged in user 
            jwt = RefreshToken.for_user(user)
            refresh_token = str(jwt) # signed tokens
            access_token = str(jwt.access_token) # signed tokens
            # GET METADATA SENT TO /ADD endpoint retreive and return resource here
            payload = {'token': token, 'username': username, 'email': request.data.get('email')}
            headers= {"Authorization": "Bearer " + access_token}
            r = requests.get('https://mp3juug.com/musicv2', headers=headers, params=payload)
            return Response({"success": "songs should be adding", "status":r.status_code, "headers": headers})
        return Response(serializer.errors, status=400)
    
# Login + create jwt 
class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):   
        print(request.data)    
        try:
            serializer = LoginSerializer(data=request.data)
            username = request.data.get("username")
            password = request.data.get("password")
            if serializer.is_valid():
                user = authenticate(
                    request=request,
                    username=username,
                    password=password
                )
                if not user:
                    raise exceptions.APIException({'error': 'Invalid credentials'})
                if not user.is_active:
                    raise exceptions.APIException({'error': 'User is inactive'})
                jwt = RefreshToken.for_user(user)
                refresh_token = str(jwt) # signed tokens
                access_token = str(jwt.access_token) # signed tokens
                # after sign in api get user home page 
                r = request.get('http://undergroundradio.us/ground') 
                return Response(
                    {
                        "access": access_token,
                        "refresh": refresh_token
                        }
                    )
        except:
            raise exceptions.APIException({'error': "login credentials not valid"})


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


