from myapp.models import User, Song, Library
from django.shortcuts import render
from django.http import HttpResponse
from rest_framework import routers, viewsets
from rest_framework.views import exception_handler
from myapp.serializers import AccountSerializer, SongSerializer, LibrarySerializer
from datetime import datetime
# Create your backend logic here.
# views.py
class AccountViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = AccountSerializer

class SongViewSet(viewsets.ModelViewSet):
    queryset = Song.objects.all()
    serializer_class = SongSerializer

class LibraryViewSet(viewsets.ModelViewSet):
    queryset = Library.objects.all()
    serializer_class = LibrarySerializer

# create user + add song to library
# https://undergroundradio.us/music/?token=xxxx
def music(request):
    if request.method == 'POST':
    # this token represents the resource 
    # which matters after authorization
        token = request.GET.get('token')
        # GET UG RADIO ACC SIGN UP CREDENTIALS
        username = request.POST.get('username')
        password = request.POST.get('password')
        email = request.POST.get('email')
        phone_number = request.POST.get('phone_number')
        date_create = datetime.now() # LOCAL TIMEZONE

        return HttpResponse('create account')
    # CHECK AUTHORIZATION TOKEN AND GIVE SONG
    elif request.method == "GET":
        return HttpResponse('get songs')

def library(request):
     return HttpResponse('fuc3')

def play(request):
     return HttpResponse('fuc4')

def nft(request):
    return HttpResponse('fuc4')

def account(request):
    return HttpResponse('fuc5')
