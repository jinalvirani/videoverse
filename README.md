
## Quick start
### Prerequisites
* Node.js version 20.x.x or above is required. You can install it from [Node.js Official Website](https://docs.npmjs.com/).

### Step
- Clone repository.
- In the repo root directory, run `npm install` to gather all dependencies.
-  Next, run `npm run seed` which will seed the local SQLite database and populate user data. **Warning: This will drop the database if it exists**. The database lives in a local file `database.sqlite3`.
-  Then run `npm run start` which should start the server.

### Technical Notes
- The server is running with [nodemon](https://nodemon.io/) which will automatically restart for you when you modify and save a file.
- The database provider is SQLite, which will store data in a file local to your repository called `database.sqlite3`.
- The server is running on port 3000.

### Commands

Start the server:
```shell
npm run start
```
Run test case:
```shell
npm run test
```
```shell
npm run test:coverage
```

### Developer's note for reviewer

- Implemented Routes: All required routes have been implemented, including video uploads, trimming, and sharing, with integration to AWS S3 for storage.

- Test Coverage: Comprehensive Jest test cases have been added, covering all potential edge cases, with a test coverage of over 98%.

- Postman Collection: An exported Postman collection (Videoverse.postman_collection.json) is provided for easy testing of the API endpoints.

- Assumptions Made:
    - A dummy user collection is assumed, with each user having an associated authentication token.
    - A one-to-many relationship is assumed between users and videos, where one user can upload multiple videos.
    - Only the owner of a video is allowed to upload, trim, or share the video.
    - For the video merge functionality, it is assumed that the merged video data does not need to be stored in the database. Instead, a 5-minute expiry link is provided after the video merge operation.
---------------------------------------------------------------------------------------------------------------------


#### Docs reffered during assigment:
- https://www.npmjs.com/package/multer
- https://www.npmjs.com/package/fluent-ffmpeg
- https://www.npmjs.com/package/aws-sdk
