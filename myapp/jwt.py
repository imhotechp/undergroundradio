import jwt
# local: /Users/colby/.ssh/id_rsa_pub.pem
with open("/srv/id_rsa_pub.pem") as f:
    public_key = f.read()

def test_decode(token):
    payload = jwt.decode(
        token, 
        public_key, 
        algorithms=['RS256'],
        options={"verify_exp": True}
    )
    return payload
