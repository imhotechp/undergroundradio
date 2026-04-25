import jwt
# local: /Users/colby/.ssh/id_rsa_pub.pem
with open("/srv/id_rsa_pub.pem") as f:
    public_key = f.read()

#  USE THIS IN MP3JUUG 
def test_decode(token):
    print(public_key)
    print(token)
    payload = jwt.decode(
        token, 
        public_key, 
        algorithms=['RS256'],
        options={"verify_exp": True}
    )
    return payload