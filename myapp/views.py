from rest_framework.response import Response
from rest_framework import exceptions
from rest_framework.views import APIView
from myapp.serializers import AccountSerializer, LoginSerializer, SongSerializer, LibrarySerializer
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from myapp.jwt import test_decode
# Creates user account
class AccountView(APIView):
    permission_classes = [AllowAny]
# create user + add song to library
# https://undergroundradio.us/music/?token=xxxx
    def post(self, request):
        try:
                request.data["date_created"] = timezone.now().isoformat()
                #  token = request.query_params('token')
                # GET UG RADIO ACC SIGN UP CREDENTIALS
                serializer = AccountSerializer(data=request.data)
                if serializer.is_valid():
                    serializer.save()
                    try:
                        #. search = find(token)
                        return Response(request.data)
                    except:
                        Response({"msg": "token invalid"})
                        
                return Response(serializer.errors)
        except: 
            raise exceptions.ParseError(detail="User credentials didn't parse correctly")
       
    def account(request):
        return Response('fuc5')

# Login + create jwt to pass to juug for exchange for resource
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
                refresh_token = str(jwt)
                access_token = str(jwt.access_token)
                test1 = test_decode(refresh_token)
                test2 = test_decode(access_token)
                return Response(
                    {
                        "access": test1,
                        "refresh": test2
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

class LibraryView(APIView):
   def library(request):
     return Response('fuc3')




