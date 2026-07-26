import jwt
from django.conf import settings

public_key = settings.SIMPLE_JWT["VERIFYING_KEY"]

#  USE THIS IN MP3JUUG 
def test_decode(token):
    payload = jwt.decode(
        token, 
        public_key, 
        algorithms=['RS256'],
        options={"verify_exp": True}
    )
    return payload