from rest_framework.response import Response
from rest_framework.views import APIView
from myapp.serializers import AccountSerializer, SongSerializer, LibrarySerializer
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.db.models import Count
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView
from django.utils.dateparse import parse_duration
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
import re
import requests
from myapp.models import Library, Song

User = get_user_model()

HEX_COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')
THEME_KEYS = {'bg', 'fg', 'navBg', 'accent'}


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


def send_welcome_email(user):
    """Best-effort account-creation confirmation — a slow or broken email
    provider must never block or break the signup response."""
    try:
        send_mail(
            subject='Welcome to Underground Radio',
            message=(
                f'Hey {user.username}, your account is ready.\n\n'
                'Start streaming at https://undergroundradio.us/home'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as e:
        print('send_welcome_email failed:', e, flush=True)


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
        # annotate instead of library.song.count() per row in a loop — that
        # was one extra query per playlist instead of one query total
        libraries = Library.objects.filter(username=request.user).annotate(
            song_count=Count('song')
        )
        data = [
            {
                "id": library.pk,
                "name": library.name,
                "coverArt": library.coverArt,
                "song_count": library.song_count,
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
            "theme": user.theme,
        })

    # Partial update: each recognized top-level key is applied independently
    # so a client can send just the one thing that changed (e.g. only
    # 'username', or only 'theme', which itself merges into the saved theme
    # instead of replacing it outright).
    def patch(self, request):
        updated = {}

        if 'username' in request.data:
            username = (request.data.get('username') or '').strip().lower()
            if len(username) < 3 or len(username) > 20:
                return Response({'error': 'Username must be between 3 and 20 characters.'}, status=400)
            if not re.match(r"^\w+$", username):
                return Response(
                    {'error': 'Only letters, numbers, and underscores are allowed in username.'},
                    status=400,
                )
            if User.objects.exclude(pk=request.user.pk).filter(username=username).exists():
                return Response({'error': 'That username is already taken.'}, status=400)
            request.user.username = username
            try:
                request.user.save(update_fields=['username'])
            except IntegrityError:
                return Response({'error': 'That username is already taken.'}, status=400)
            updated['username'] = username

        if 'theme' in request.data:
            theme = request.data.get('theme')
            if not isinstance(theme, dict):
                return Response({'error': 'theme must be an object'}, status=400)
            if not set(theme.keys()) <= THEME_KEYS:
                return Response({'error': 'invalid theme keys'}, status=400)
            for value in theme.values():
                if not isinstance(value, str) or not HEX_COLOR_RE.match(value):
                    return Response({'error': 'theme values must be hex colors like #rrggbb'}, status=400)
            request.user.theme = {**request.user.theme, **theme}
            request.user.save(update_fields=['theme'])
            updated['theme'] = request.user.theme

        if not updated:
            return Response({'error': 'Nothing to update.'}, status=400)

        return Response(updated)


# Redeems a /musicv2?token=... link for a session that's already
# authenticated (e.g. opened in a browser that already has another tab
# logged in) — same effect as the token handling in AccountView/LoginView,
# just without forcing a re-login through a username/password form first.
# Reuses the caller's existing access token (no need to mint a new one) as
# the one handed to mp3juug.com.
class TokenRedeemView(APIView):
    def post(self, request):
        token = request.query_params.get('token') or request.data.get('token')
        if not token:
            return Response({'error': 'token is required.'}, status=400)
        request.user.pending_song_token = token
        request.user.save(update_fields=['pending_song_token'])
        notify_mp3juug(token, request.user.username, request.user.email, str(request.auth))
        return Response({'detail': 'ok'})


# Create an account. This is the entry point for links like
# /musicv2?token=... from mp3juug.com — the token references a song that
# should be delivered to whoever completes signup through that link.
class AccountView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        token = request.query_params.get('token')
        serializer = AccountSerializer(data=request.data)
        if not serializer.is_valid():
            # Keyed per-field so the frontend can show each error under its
            # own input instead of one generic message the user has to guess
            # the box for.
            field_errors = {field: str(msgs[0]) for field, msgs in serializer.errors.items()}
            return Response({'errors': field_errors}, status=400)

        try:
            user = serializer.save()
        except IntegrityError:
            return Response({'errors': {'username': 'That username is already taken.'}}, status=400)
        jwt = RefreshToken.for_user(user)
        refresh_token = str(jwt)
        access_token = str(jwt.access_token)

        send_welcome_email(user)

        if token:
            user.pending_song_token = token
            user.save(update_fields=['pending_song_token'])
            notify_mp3juug(token, user.username, user.email, access_token)

        return Response({"access": access_token, "refresh": refresh_token})

# Login. Also doubles as the /musicv2?token=... entry point for a returning
# user — same as AccountView, if a token is present the song it references
# gets attached via the mp3juug.com notification below.
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        # Usernames are always stored lowercased (see AccountSerializer.validate
        # and MeView.patch) — Postgres text equality is case-sensitive, so without
        # this, a mismatched case (e.g. a mobile keyboard auto-capitalizing the
        # first letter) looks exactly like a wrong password from the user's side.
        username = (request.data.get("username") or "").strip().lower()
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
            user.pending_song_token = token
            user.save(update_fields=['pending_song_token'])
            notify_mp3juug(token, user.username, user.email, access_token)

        return Response({"access": access_token, "refresh": refresh_token})


# Step 1 of forgot-password: emails a reset link if the username exists.
# Always returns the same response either way — revealing which usernames
# are/aren't registered would let an attacker enumerate accounts.
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        username = (request.data.get('username') or '').strip().lower()
        if username:
            user = User.objects.filter(username=username).first()
            if user and user.email:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                reset_link = f'https://undergroundradio.us/reset-password?uid={uid}&token={token}'
                try:
                    send_mail(
                        subject='Reset your Underground Radio password',
                        message=(
                            f'Hey {user.username}, someone requested a password reset '
                            f'for your account. If this was you, reset it here:\n\n'
                            f'{reset_link}\n\n'
                            "If you didn't request this, you can ignore this email."
                        ),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[user.email],
                        fail_silently=False,
                    )
                except Exception as e:
                    print('send_password_reset_email failed:', e, flush=True)

        return Response({'detail': 'If that account exists, a reset link has been sent.'})


# Step 2: validates the token from the emailed link and sets the new password.
class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        if not uid or not token or not new_password:
            return Response({'error': 'uid, token, and new_password are required.'}, status=400)

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({'error': 'Invalid or expired reset link.'}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired reset link.'}, status=400)

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({'error': ' '.join(e.messages)}, status=400)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password reset successfully.'})


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


def _as_list(value, count):
    """Normalizes a per-song field that may arrive as either a bare scalar
    (the convention artist_name/email already require for a single-song
    call) or a list (one entry per song in `song`). A scalar used to get
    blindly indexed below (urls[i]) — which, for a string, indexes into its
    individual *characters* instead of raising, silently truncating e.g. a
    url down to its first letter. Returns None when a scalar can't be
    unambiguously mapped onto more than one song."""
    if isinstance(value, list):
        return value
    if value in (None, ''):
        return []
    if count == 1:
        return [value]
    return None


class LibraryView(APIView):
    # Default IsAuthenticated (see REST_FRAMEWORK settings) — JWTAuthentication
    # already verified the token and set request.user before this runs, so the
    # library being modified is always the caller's own, never a client-supplied one.
    def post(self, request):
        # Redeeming a song requires the exact mp3juug.com token issued to this
        # account's most recent signup/login (see AccountView/LoginView) —
        # without this, any authenticated user could POST arbitrary song data
        # into their own library (and the shared Song table) with no relation
        # to a real token hand-off at all. Cleared on success below so a
        # token can't be replayed once redeemed; left intact on a validation
        # error so a genuinely malformed delivery attempt can be retried.
        token = request.query_params.get('token') or request.data.get('token')
        if not token or not request.user.pending_song_token or token != request.user.pending_song_token:
            return Response({'error': 'Invalid or missing token.'}, status=403)

        songs = request.data.get('song')
        if not isinstance(songs, list) or not songs:
            return Response({'error': 'song must be a non-empty list.'}, status=400)
        urls = _as_list(request.data.get('url'), len(songs))
        if urls is None:
            return Response({'error': 'url must be a list matching song when adding multiple songs.'}, status=400)
        durations = _as_list(request.data.get('duration'), len(songs))
        if durations is None:
            return Response({'error': 'duration must be a list matching song when adding multiple songs.'}, status=400)
        cover_arts = _as_list(request.data.get('coverArt'), len(songs))
        if cover_arts is None:
            return Response({'error': 'coverArt must be a list matching song when adding multiple songs.'}, status=400)
        results = []
        # Save each song individually since request song param is []
        for i, song_value in enumerate(songs):
            # copy reuqest.data since immutable & set one value at a time
            data = request.data.copy()
            data['song'] = song_value
            data['url'] = urls[i] if i < len(urls) else ''
            data['coverArt'] = cover_arts[i] if i < len(cover_arts) else ''
            # parse_duration('') parses as a real 0:00:00, not an error — omit
            # the key entirely when there's no value instead of storing a fake
            # zero duration for a song whose length just wasn't captured
            # Validate before handing it to SongSerializer — a malformed
            # duration (whatever shape the caller sent) used to fail the
            # entire song add, even though duration is just optional
            # metadata. Drop it instead of blocking the song.
            duration_value = durations[i] if i < len(durations) else ''
            if duration_value:
                # mp3juug sends a raw JS float (audio.duration), which often
                # carries far more decimal digits than parse_duration's
                # microsecond precision (6 digits) can match — e.g.
                # 116.32326530612245 — making an otherwise-valid duration
                # look unparseable. Round first.
                try:
                    duration_value = round(float(duration_value), 6)
                except (TypeError, ValueError):
                    pass
            if duration_value and parse_duration(str(duration_value)) is not None:
                data['duration'] = duration_value
            else:
                if duration_value:
                    print('dropping unparseable duration:', repr(duration_value), flush=True)
                data.pop('duration', None)

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
                # Refresh with fresher incoming data whenever a non-empty
                # value is given — not just when the existing field is
                # blank. Used to only backfill gaps, which meant an artist
                # re-uploading a fixed/better version of a song (same
                # title/artist/email) could never get the delivered URL to
                # actually update, since the original was already non-blank.
                update_fields = []
                if data.get('url') and existing_song.url != data['url']:
                    existing_song.url = data['url']
                    update_fields.append('url')
                if data.get('coverArt') and existing_song.coverArt != data['coverArt']:
                    existing_song.coverArt = data['coverArt']
                    update_fields.append('coverArt')
                if data.get('duration'):
                    parsed = parse_duration(str(data['duration']))
                    if parsed is not None and existing_song.duration != parsed:
                        existing_song.duration = parsed
                        update_fields.append('duration')
                if update_fields:
                    existing_song.save(update_fields=update_fields)
            else:
                # No resolvable stream URL (e.g. the Upload row this link
                # pointed at was deleted after the link was created) — skip
                # this song rather than create a library entry that looks
                # playable but isn't. Dropped, not a 400: unlike a missing
                # artist_name (fixable by re-uploading), there's no retry
                # that would ever fix a URL that genuinely no longer exists.
                if not data.get('url'):
                    print('skipping song with no resolvable url:', repr(song_value), flush=True)
                    continue
                song_serializer = SongSerializer(data=data)
                if song_serializer.is_valid():
                    # save song(s) to song table
                    obj = song_serializer.save()
                    obj_pk = obj.pk
                else:
                    print('errors:', song_serializer.errors, flush=True)
                    return Response(song_serializer.errors, status=400)

            # skip songs this user already has anywhere in their library —
            # re-redeeming the same link shouldn't duplicate the entry
            if Library.objects.filter(username=request.user, song__pk=obj_pk).exists():
                continue
            results.append(obj_pk)

        if not results:
            request.user.pending_song_token = None
            request.user.save(update_fields=['pending_song_token'])
            # `added: False` lets mp3juug's /musicv2 tell a genuine delivery
            # apart from a no-op — without it, redeeming a link against an
            # account that already has these songs still returned 200,
            # which mp3juug's response.ok check treated as a real success
            # and burned the one-time link/card for nothing.
            return Response({"song(s)": "already in library", "added": False})

        # same thing for library.. Library.coverArt is one scalar cover per
        # playlist, not per-song — cover_arts is now always a list (even for
        # one song), so use the first song's as this playlist's cover.
        data = request.data.copy()
        data['song'] = results
        data['coverArt'] = cover_arts[0] if cover_arts else ''
        # Library.name defaults to the literal string "Playlist001" — every
        # playlist a user ever got was named exactly that with no sequence
        # number, since nothing here ever overrode it. Number sequentially
        # per user instead. (Count-then-insert, not atomic — two concurrent
        # redemptions for the same user could in theory land on the same
        # number; low-risk for how infrequently this fires.)
        next_number = Library.objects.filter(username=request.user).count() + 1
        data['name'] = f"Playlist{next_number:03d}"
        serializer = LibrarySerializer(data=data)
        if serializer.is_valid():
            # User object is foreign key to library table so we include
            serializer.save(username=request.user)
            request.user.pending_song_token = None
            request.user.save(update_fields=['pending_song_token'])
            return Response({"song(s)": "should have added to library", "added": True})
        else:
            print(serializer.errors)
            return Response({"error": 'something didnt parse right'}, status=400)


