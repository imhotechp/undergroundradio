from rest_framework.response import Response
from rest_framework import exceptions
from rest_framework.views import APIView
from myapp.serializers import AccountSerializer, LoginSerializer, SongSerializer, LibrarySerializer
from .models import Library, Song
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
import requests
import asyncio
from myapp.db import main
from myapp.jwt import test_decode
from myapp.models import User
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
            token = request.query_params.get('token') # get this from URL query
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
                if not token:
                    raise exceptions.APIException({'error': 'No token'})
                r = request.get('https://mp3juug.com/token')
                return Response(
                    {
                        "access": access_token,
                        "refresh": refresh_token
                        }
                    )
                # create RSA Key pair (private and public)
                # give public key to MP3JUUG
                # sign jwts with private key
        except:
            raise exceptions.APIException({'error': "login credentials not valid"})


class SongView(APIView):
    def play(request):
     return Response('fuc4')
    def nft(request):
        return Response('fuc4')

# 3/13/26 use email + song to search db and add to library 
class LibraryView(APIView):
  # need to verify incoming jwt
    def post(self, request):
        songs = request.data.getlist('song') 
        results = []
        # Save all songs and add pks to array
        for song_value in songs:
            data = request.data.copy()
            data['song'] = song_value  # set one value at a time

            song_serializer = SongSerializer(data=data)
            if song_serializer.is_valid():
                obj = song_serializer.save()
                results.append(obj.pk)
            else:
                print('errors:', song_serializer.errors, flush=True)
                return Response(song_serializer.errors, status=400)
        for pks in results:
            data = request.data.copy()
            data['song'] = pks
            library_serializer = LibrarySerializer(data=data)
            if library_serializer.is_valid():
                obj = library_serializer.save()
                print('Objects should be in user library')
            else:
                return Response(library_serializer.errors, status=400)
        return Response({
            "created_ids": results
        })


