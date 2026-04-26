from pymongo import AsyncMongoClient

# Create a new client and connect to the server


async def main(email, song, coverArt):
    try:
        uri = "mongodb+srv://GM:LNTC@amoco-cadiz.9c3xn4v.mongodb.net/?appName=Amoco-Cadiz"
        client = AsyncMongoClient(uri)
        database = client["test"]
        uploads = database["uploads"]
        coverArt = database["coverarts"]
        songs = []
        coverArt = coverArt.find_one({"coverArt": coverArt})

        # for every song, use email and song name to find url
        for s in song:
            song_search = uploads.find({"email": email, song: s})
            url = song_search['url']
            async for urls in url:
                # add song urls to array
                songs.append(urls)
            await client.close()
        print(coverArt, songs)
        return {coverArt: songs}

    except Exception as e:
        raise Exception(
            "The following error occurred: ", e)

