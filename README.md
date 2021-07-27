
# ![Syncwatch](/docs/syncwatch_logo.png?raw=true "Syncwatch")

File sharing and synced video streaming server to watch movies with your best friends.


## Features

- rooms with synced videoplayers and chat
- multiple audio tracks for different languages and subtitles per video
- watchtime tracking and fast forward to the position where you stopped watched the last time 
- easy download of files and movies from youtube using [youtube-dl](https://github.com/ytdl-org/youtube-dl)
- different styles to please your eyes at every time


## Installation

Syncwatch is running on NodeJS 12.x. [Get NodeJS for your system here.](https://nodejs.org/en/)

```bash
# Clone the repository
git clone https://github.com/syncwatch/syncwatch

# Change into the repository folder
cd syncwatch

# Install dependencies
npm install
```

Don't forget to copy the example database file `server.db.example` to `server.db` after every breaking update.

And adjust the `FILES_PATH` variable inside `settings.js` to specify where files and videos should be stored.

```bash
# Start the syncwatch server
npm start
```

You can now access syncwatch from your browser at [`http://localhost:3000/`](http://localhost:3000/)


## Screenshots

![Screenshot Files](/docs/screenshot_files.png?raw=true "Screenshot Files")

![Screenshot Room](/docs/screenshot_room.png?raw=true "Screenshot Room")

![Screenshot Watched](/docs/screenshot_watched.png?raw=true "Screenshot Watched")